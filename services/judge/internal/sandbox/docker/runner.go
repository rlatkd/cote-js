// Package docker — Runner 포트의 Docker 컨테이너 격리 어댑터 (샌드박스 1단계, ADR-0009).
//
// 격리는 도커 옵션으로 건다: 네트워크 차단·메모리/CPU/프로세스 수 상한·read-only 루트·
// 비특권 유저·권한 상승 차단. 커널 기능(cgroups/namespaces/seccomp) 직접 제어(2단계)로
// 갈 때 이 어댑터만 교체한다 — executor·domain은 불변.
//
// 언어별 차이(이미지·소스명·실행 명령·메모리 강제 방식)는 internal/language가 소유하고,
// 이 어댑터는 그 명세를 컨테이너 실행 인자로 옮기기만 한다.
package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/rlatkd/cotejs/services/judge/internal/domain"
	"github.com/rlatkd/cotejs/services/judge/internal/language"
)

const (
	// 컨테이너 메모리 상한 = 유효 한도 + 여유분. 정밀 한도는 harness가 언어별 방식으로
	// 건다(RLIMIT_AS 또는 런타임 힙 옵션) — 컨테이너 상한은 backstop이며, 여유를 두지 않으면
	// 커널 OOM killer가 harness를 죽여 유저의 MLE가 시스템 장애로 둔갑한다.
	containerMemMarginMB = 128
	pidsLimit            = 64
	// 컨테이너 기동 + 컴파일 여유. 컴파일 자체 상한은 harness가 따로 건다.
	startupMarginSec = 60
)

type Runner struct{}

func New() *Runner { return &Runner{} }

func (r *Runner) Run(ctx context.Context, spec domain.RunSpec) (domain.RunOutcome, error) {
	langSpec, err := language.Lookup(spec.Language)
	if err != nil {
		return domain.RunOutcome{}, err
	}

	name := fmt.Sprintf("judge-%d-%04d", time.Now().UnixNano(), rand.Intn(10000))

	// 전체 예산 = 케이스 수 × (시간제한 + 킬 여유) + 기동·컴파일 여유.
	budget := time.Duration(spec.CaseCount)*(time.Duration(spec.TimeLimitMS)*time.Millisecond+2*time.Second) +
		startupMarginSec*time.Second
	runCtx, cancel := context.WithTimeout(ctx, budget)
	defer cancel()

	cmd := exec.CommandContext(runCtx, "docker", dockerArgs(name, spec, langSpec)...)
	var out strings.Builder
	cmd.Stdout = &out
	cmd.Stderr = &out

	runErr := cmd.Run()
	if runCtx.Err() != nil {
		// 예산 초과 — CommandContext는 docker CLI(클라이언트)만 죽이므로 컨테이너를 직접 킬.
		_ = exec.Command("docker", "kill", name).Run()
		return domain.RunOutcome{}, fmt.Errorf("채점 예산(%s) 초과로 컨테이너 강제 종료", budget)
	}
	if runErr != nil {
		return domain.RunOutcome{}, fmt.Errorf("컨테이너 실행 실패: %w\n%s", runErr, out.String())
	}

	compile, err := readCompile(spec.WorkDir)
	if err != nil {
		return domain.RunOutcome{}, fmt.Errorf("%w\n%s", err, out.String())
	}
	if !compile.OK {
		return domain.RunOutcome{Compile: compile}, nil
	}

	cases, err := readCases(spec.WorkDir)
	if err != nil {
		return domain.RunOutcome{}, fmt.Errorf("%w\n%s", err, out.String())
	}
	return domain.RunOutcome{Compile: compile, Cases: cases}, nil
}

func dockerArgs(name string, spec domain.RunSpec, langSpec language.Spec) []string {
	compileCmd, _ := json.Marshal(langSpec.CompileCmd)
	runCmd, _ := json.Marshal(langSpec.RunCmd)

	return []string{
		"run", "--rm", "--name", name,
		"--network", "none",
		"--memory", fmt.Sprintf("%dm", spec.MemoryLimitMB+containerMemMarginMB),
		"--memory-swap", fmt.Sprintf("%dm", spec.MemoryLimitMB+containerMemMarginMB), // 스왑 금지
		"--cpus", "1",
		"--pids-limit", fmt.Sprintf("%d", pidsLimit),
		// 루트는 읽기 전용이되 작업 디렉토리(바인드)와 /tmp만 쓰기 가능.
		// 컴파일 산출물(.class 등)은 작업 디렉토리에 떨어진다.
		"--read-only",
		"--tmpfs", "/tmp:size=64m",
		"--user", "65534:65534", // nobody — 비특권 실행
		"--security-opt", "no-new-privileges",
		"--cap-drop", "ALL",
		"-v", spec.WorkDir + ":/judge",
		"-e", fmt.Sprintf("CASE_COUNT=%d", spec.CaseCount),
		"-e", fmt.Sprintf("TIME_LIMIT_MS=%d", spec.TimeLimitMS),
		"-e", fmt.Sprintf("MEM_LIMIT_MB=%d", spec.MemoryLimitMB),
		"-e", "COMPILE_CMD=" + string(compileCmd),
		"-e", "RUN_CMD=" + string(runCmd),
		"-e", "MEM_MODE=" + string(langSpec.MemoryMode),
		"-e", "OOM_SIGNATURE=" + langSpec.OOMSignature,
		langSpec.Image,
	}
}

func readCompile(workDir string) (domain.CompileOutput, error) {
	data, err := os.ReadFile(filepath.Join(workDir, "compile.json"))
	if err != nil {
		return domain.CompileOutput{}, fmt.Errorf("harness 컴파일 결과 누락: %w", err)
	}
	var out domain.CompileOutput
	if err := json.Unmarshal(data, &struct {
		OK  *bool   `json:"ok"`
		Log *string `json:"log"`
	}{OK: &out.OK, Log: &out.Log}); err != nil {
		return domain.CompileOutput{}, fmt.Errorf("harness 컴파일 결과 파싱 실패: %w", err)
	}
	return out, nil
}

func readCases(workDir string) ([]domain.RawCaseResult, error) {
	data, err := os.ReadFile(filepath.Join(workDir, "result.json"))
	if err != nil {
		return nil, fmt.Errorf("harness 결과 누락: %w", err)
	}
	var raws []domain.RawCaseResult
	if err := json.Unmarshal(data, &raws); err != nil {
		return nil, fmt.Errorf("harness 결과 파싱 실패: %w", err)
	}
	return raws, nil
}
