// Package executor — 채점 오케스트레이션. 번들 검증 → 작업 공간 준비 → 러너 실행 →
// 출력 비교 → 판정 집계. 러너(샌드박스)와 번들 출처는 포트 뒤라 이 층은 전송·인프라 무관.
package executor

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/rlatkd/cotejs/services/judge/internal/domain"
)

type Executor struct {
	runner domain.Runner
}

func New(runner domain.Runner) *Executor {
	return &Executor{runner: runner}
}

// Judge는 채점 1건을 수행한다. 시스템 장애만 error로 나가고,
// 유저 귀책(오답·시간초과·컴파일 실패 등)은 JudgeResult.Verdict에 담긴다.
func (e *Executor) Judge(ctx context.Context, task domain.Task) (domain.JudgeResult, error) {
	fail := func(err error) (domain.JudgeResult, error) {
		return domain.JudgeResult{
			SubmissionID: task.SubmissionID,
			Verdict:      domain.VerdictInternalError,
			ErrorMessage: err.Error(),
		}, err
	}

	cases, err := loadBundle(task.BundleDir)
	if err != nil {
		return fail(fmt.Errorf("번들 로드 실패: %w", err))
	}

	workDir, err := prepareWorkspace(task, cases)
	if err != nil {
		return fail(fmt.Errorf("작업 공간 준비 실패: %w", err))
	}
	defer os.RemoveAll(workDir)

	spec := domain.RunSpec{
		WorkDir:       workDir,
		CaseCount:     len(cases),
		TimeLimitMS:   task.TimeLimitMS,
		MemoryLimitMB: task.MemoryLimitMB,
	}

	compile, err := e.runner.Compile(ctx, spec)
	if err != nil {
		return fail(fmt.Errorf("컴파일 단계 장애: %w", err))
	}
	if !compile.OK {
		return domain.JudgeResult{
			SubmissionID: task.SubmissionID,
			Verdict:      domain.VerdictCompileError,
			ErrorMessage: compile.Log,
		}, nil
	}

	raws, err := e.runner.RunCases(ctx, spec)
	if err != nil {
		return fail(fmt.Errorf("실행 장애: %w", err))
	}

	return e.aggregate(task, workDir, cases, raws), nil
}

func (e *Executor) aggregate(task domain.Task, workDir string, cases []bundleCase, raws []domain.RawCaseResult) domain.JudgeResult {
	result := domain.JudgeResult{
		SubmissionID: task.SubmissionID,
		Verdict:      domain.VerdictAccepted,
	}

	byNo := make(map[int]domain.RawCaseResult, len(raws))
	for _, r := range raws {
		byNo[r.No] = r
	}

	for i, c := range cases {
		no := i + 1
		raw, ok := byNo[no]
		if !ok {
			// 러너가 케이스 결과를 누락 — 시스템 장애로 취급.
			result.Verdict = domain.VerdictInternalError
			result.ErrorMessage = fmt.Sprintf("케이스 %d 결과 누락", no)
			return result
		}

		cr := domain.CaseResult{No: no, ExecTimeMS: raw.ExecTimeMS, MemoryUsedKB: raw.MemoryUsedKB}
		switch {
		case raw.TimedOut:
			cr.Verdict = domain.VerdictTimeLimitExceeded
		case raw.MemExceeded:
			cr.Verdict = domain.VerdictMemoryLimitExceeded
		case raw.ExitCode != 0:
			cr.Verdict = domain.VerdictRuntimeError
		default:
			got, err := os.ReadFile(filepath.Join(workDir, "out", fmt.Sprintf("%02d.out", no)))
			if err != nil {
				got = nil
			}
			if outputMatches(string(got), c.expected) {
				cr.Verdict = domain.VerdictAccepted
			} else {
				cr.Verdict = domain.VerdictWrongAnswer
			}
		}

		result.Cases = append(result.Cases, cr)
		if cr.ExecTimeMS > result.ExecTimeMS {
			result.ExecTimeMS = cr.ExecTimeMS
		}
		if cr.MemoryUsedKB > result.MemoryUsedKB {
			result.MemoryUsedKB = cr.MemoryUsedKB
		}
		// 종합 판정 = 첫 실패 케이스. 이후 케이스는 계속 실행해 케이스별 결과는 전부 남긴다.
		if cr.Verdict != domain.VerdictAccepted && result.Verdict == domain.VerdictAccepted {
			result.Verdict = cr.Verdict
		}
	}
	return result
}

// --- 번들 ---
// 번들 레이아웃: <bundleDir>/cases/NN.in + NN.out (01부터 연번).
type bundleCase struct {
	input    string
	expected string
}

func loadBundle(dir string) ([]bundleCase, error) {
	casesDir := filepath.Join(dir, "cases")
	entries, err := os.ReadDir(casesDir)
	if err != nil {
		return nil, err
	}
	var ins []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".in") {
			ins = append(ins, e.Name())
		}
	}
	if len(ins) == 0 {
		return nil, fmt.Errorf("케이스 없음: %s", casesDir)
	}
	sort.Strings(ins)

	var cases []bundleCase
	for _, name := range ins {
		in, err := os.ReadFile(filepath.Join(casesDir, name))
		if err != nil {
			return nil, err
		}
		outName := strings.TrimSuffix(name, ".in") + ".out"
		out, err := os.ReadFile(filepath.Join(casesDir, outName))
		if err != nil {
			return nil, fmt.Errorf("기대 출력 누락: %s", outName)
		}
		cases = append(cases, bundleCase{input: string(in), expected: string(out)})
	}
	return cases, nil
}

// prepareWorkspace는 임시 작업 디렉토리를 만든다:
//   main.py       제출 소스
//   cases/NN.in   케이스 입력(01부터 연번으로 정규화)
//   out/          러너가 케이스 출력을 쓸 자리
func prepareWorkspace(task domain.Task, cases []bundleCase) (string, error) {
	workDir, err := os.MkdirTemp("", "judge-*")
	if err != nil {
		return "", err
	}
	ok := false
	defer func() {
		if !ok {
			os.RemoveAll(workDir)
		}
	}()

	for _, sub := range []string{"cases", "out"} {
		if err := os.Mkdir(filepath.Join(workDir, sub), 0o755); err != nil {
			return "", err
		}
	}
	if err := os.WriteFile(filepath.Join(workDir, "main.py"), []byte(task.SourceCode), 0o644); err != nil {
		return "", err
	}
	for i, c := range cases {
		name := fmt.Sprintf("%02d.in", i+1)
		if err := os.WriteFile(filepath.Join(workDir, "cases", name), []byte(c.input), 0o644); err != nil {
			return "", err
		}
	}
	ok = true
	return workDir, nil
}

// outputMatches — 표준 저지 비교: 각 줄의 후행 공백 제거 + 마지막 빈 줄들 무시.
func outputMatches(got, expected string) bool {
	return normalize(got) == normalize(expected)
}

func normalize(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	lines := strings.Split(s, "\n")
	for i := range lines {
		lines[i] = strings.TrimRight(lines[i], " \t")
	}
	for len(lines) > 0 && lines[len(lines)-1] == "" {
		lines = lines[:len(lines)-1]
	}
	return strings.Join(lines, "\n")
}
