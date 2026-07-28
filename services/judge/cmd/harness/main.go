// harness — 컨테이너 **안에서** 도는 채점 실행기. 러너 이미지마다 이 바이너리가 들어간다.
//
// 왜 Go 단일 바이너리인가: 언어별로 하니스를 따로 쓰면(파이썬용·자바용…) 같은 로직이
// 복제되고, 하니스를 파이썬으로 통일하면 **Java·Node 이미지에까지 파이썬을 설치**해야 한다.
// 정적 링크된 Go 바이너리는 어느 베이스 이미지에도 그냥 얹힌다(러너 Dockerfile의 멀티스테이지).
//
// 판정은 하지 않는다 — 관측 사실만 보고하고 Verdict 번역은 바깥 executor의 몫이다.
//
// 계약(도커 어댑터와 합의):
//
//	입력  /judge/<소스파일>, /judge/cases/NN.in, 아래 환경변수
//	출력  /judge/out/NN.out(케이스별 stdout) · /judge/compile.json · /judge/result.json
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	judgeDir = "/judge"
	// 컴파일이 무한정 돌지 않게(악의적 소스가 컴파일러를 폭주시킬 수 있다).
	compileTimeout = 30 * time.Second
	// stderr는 판정 보조용이라 앞부분만 있으면 된다 — 로그 폭주 방지.
	stderrCap = 8 * 1024
)

type caseResult struct {
	No          int    `json:"no"`
	ExitCode    int    `json:"exit_code"`
	TimedOut    bool   `json:"timed_out"`
	MemExceeded bool   `json:"mem_exceeded"`
	TimeMS      uint32 `json:"time_ms"`
	MemKB       uint32 `json:"mem_kb"`
}

type compileResult struct {
	OK  bool   `json:"ok"`
	Log string `json:"log"`
}

type config struct {
	caseCount    int
	timeLimitMS  int
	memLimitMB   int
	compileCmd   []string
	runCmd       []string
	memoryMode   string
	oomSignature string
}

func main() {
	cfg := loadConfig()

	if len(cfg.compileCmd) > 0 {
		if out, ok := compile(cfg); !ok {
			writeJSON("compile.json", compileResult{OK: false, Log: out})
			// 컴파일 실패는 **유저 귀책**이므로 하니스는 정상 종료한다(시스템 장애가 아니다).
			return
		}
	}
	writeJSON("compile.json", compileResult{OK: true})

	results := make([]caseResult, 0, cfg.caseCount)
	for no := 1; no <= cfg.caseCount; no++ {
		results = append(results, runCase(cfg, no))
	}
	writeJSON("result.json", results)
}

func compile(cfg config) (string, bool) {
	cmd := exec.Command(cfg.compileCmd[0], cfg.compileCmd[1:]...)
	cmd.Dir = judgeDir

	done := make(chan struct{})
	timer := time.AfterFunc(compileTimeout, func() {
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		close(done)
	})

	out, err := cmd.CombinedOutput()
	if !timer.Stop() {
		<-done
		return fmt.Sprintf("컴파일 시간 초과(%s)", compileTimeout), false
	}
	if err != nil {
		return trim(string(out)), false
	}
	return "", true
}

func runCase(cfg config, no int) caseResult {
	inPath := filepath.Join(judgeDir, "cases", fmt.Sprintf("%02d.in", no))
	outPath := filepath.Join(judgeDir, "out", fmt.Sprintf("%02d.out", no))

	stdin, err := os.Open(inPath)
	if err != nil {
		return caseResult{No: no, ExitCode: -1}
	}
	defer stdin.Close()

	stdout, err := os.Create(outPath)
	if err != nil {
		return caseResult{No: no, ExitCode: -1}
	}
	defer stdout.Close()

	cmd := exec.Command("/bin/sh", "-c", shellCommand(cfg))
	cmd.Dir = judgeDir
	cmd.Stdin = stdin
	cmd.Stdout = stdout
	var stderr strings.Builder
	cmd.Stderr = &capped{w: &stderr, limit: stderrCap}
	// 제출 코드가 자식을 낳아도 함께 죽이려면 프로세스 그룹이 필요하다
	// (직접 자식만 죽이면 손자가 살아남아 CPU를 계속 태운다).
	useProcessGroup(cmd)

	started := time.Now()
	if err := cmd.Start(); err != nil {
		return caseResult{No: no, ExitCode: -1}
	}

	timedOut := false
	timer := time.AfterFunc(time.Duration(cfg.timeLimitMS)*time.Millisecond, func() {
		timedOut = true
		killGroup(cmd.Process.Pid)
	})
	waitErr := cmd.Wait()
	timer.Stop()
	elapsed := uint32(time.Since(started).Milliseconds())

	exitCode := 0
	if waitErr != nil {
		if exitErr, ok := waitErr.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = -1
		}
	}
	if timedOut {
		elapsed = uint32(cfg.timeLimitMS)
	}

	return caseResult{
		No:          no,
		ExitCode:    exitCode,
		TimedOut:    timedOut,
		MemExceeded: !timedOut && exitCode != 0 && strings.Contains(stderr.String(), cfg.oomSignature),
		TimeMS:      elapsed,
		MemKB:       maxChildRSS(),
	}
}

// shellCommand — 셸을 거치는 이유는 rlimit 때문이다. Go에는 자식에만 rlimit을 거는
// 훅이 없어서(파이썬의 preexec_fn 같은 것), `ulimit`을 설정하고 exec하는 셸을 한 겹 둔다.
// exec를 쓰므로 셸 프로세스가 남지 않아 측정·시그널 전달에 방해되지 않는다.
func shellCommand(cfg config) string {
	quoted := make([]string, 0, len(cfg.runCmd))
	for _, arg := range cfg.runCmd {
		quoted = append(quoted, shellQuote(strings.ReplaceAll(arg, "{MEM_MB}", strconv.Itoa(cfg.memLimitMB))))
	}
	run := "exec " + strings.Join(quoted, " ")

	if cfg.memoryMode == "rlimit" {
		return fmt.Sprintf("ulimit -v %d; %s", cfg.memLimitMB*1024, run)
	}
	return run
}

func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

func loadConfig() config {
	return config{
		caseCount:    envInt("CASE_COUNT"),
		timeLimitMS:  envInt("TIME_LIMIT_MS"),
		memLimitMB:   envInt("MEM_LIMIT_MB"),
		compileCmd:   envJSON("COMPILE_CMD"),
		runCmd:       envJSON("RUN_CMD"),
		memoryMode:   os.Getenv("MEM_MODE"),
		oomSignature: os.Getenv("OOM_SIGNATURE"),
	}
}

func envInt(key string) int {
	n, err := strconv.Atoi(os.Getenv(key))
	if err != nil {
		fail("환경변수 %s 파싱 실패: %v", key, err)
	}
	return n
}

func envJSON(key string) []string {
	raw := os.Getenv(key)
	if raw == "" {
		return nil
	}
	var out []string
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		fail("환경변수 %s 파싱 실패: %v", key, err)
	}
	return out
}

func writeJSON(name string, v any) {
	data, err := json.Marshal(v)
	if err != nil {
		fail("결과 직렬화 실패: %v", err)
	}
	if err := os.WriteFile(filepath.Join(judgeDir, name), data, 0o644); err != nil {
		fail("결과 기록 실패: %v", err)
	}
}

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "harness: "+format+"\n", args...)
	os.Exit(1)
}

func trim(s string) string {
	if len(s) > stderrCap {
		return s[:stderrCap] + "\n… (생략)"
	}
	return s
}

// capped — 상한까지만 받아 적는 Writer(로그 폭주 방지).
type capped struct {
	w     *strings.Builder
	limit int
}

func (c *capped) Write(p []byte) (int, error) {
	if remain := c.limit - c.w.Len(); remain > 0 {
		if len(p) > remain {
			p = p[:remain]
		}
		c.w.Write(p)
	}
	return len(p), nil // 상한 초과분은 조용히 버린다(쓰기 실패로 보고하면 프로세스가 죽는다)
}
