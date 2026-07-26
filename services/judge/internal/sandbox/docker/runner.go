// Package docker — Runner 포트의 Docker 컨테이너 격리 어댑터 (샌드박스 1단계, ADR-0009).
//
// 격리는 도커 옵션으로 건다: 네트워크 차단·메모리/CPU/프로세스 수 상한·read-only 루트·
// 비특권 유저·권한 상승 차단. 커널 기능(cgroups/namespaces/seccomp) 직접 제어(2단계)로
// 갈 때 이 어댑터만 교체한다 — executor·domain은 불변.
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
)

const (
	// 러너 이미지는 judge가 소유한다(services/judge/runners/) — 어떤 인터프리터 버전으로
	// 채점하느냐는 채점의 일부이기 때문(ADR-0009).
	pythonImage = "cotejs-judge-python:3.12"
	// 컨테이너 메모리 상한 = 케이스 한도 + harness 여유분. 케이스별 정밀 한도는
	// harness가 RLIMIT_AS로 건다 — 컨테이너 상한은 backstop.
	containerMemMarginMB = 64
	pidsLimit            = 64
	startupMarginSec     = 20
)

type Runner struct{}

func New() *Runner { return &Runner{} }

// Compile — Python은 컴파일 단계가 없다(no-op). 인터페이스 자리는 언어 추가를 위해 유지.
func (r *Runner) Compile(_ context.Context, _ domain.RunSpec) (domain.CompileOutput, error) {
	return domain.CompileOutput{OK: true}, nil
}

func (r *Runner) RunCases(ctx context.Context, spec domain.RunSpec) ([]domain.RawCaseResult, error) {
	name := fmt.Sprintf("judge-%d-%04d", time.Now().UnixNano(), rand.Intn(10000))

	// 전체 예산 = 케이스 수 × (시간제한 + 킬 여유 2초) + 컨테이너 기동 여유.
	budget := time.Duration(spec.CaseCount)*(time.Duration(spec.TimeLimitMS)*time.Millisecond+2*time.Second) +
		startupMarginSec*time.Second
	runCtx, cancel := context.WithTimeout(ctx, budget)
	defer cancel()

	args := []string{
		"run", "--rm", "--name", name,
		"--network", "none",
		"--memory", fmt.Sprintf("%dm", spec.MemoryLimitMB+containerMemMarginMB),
		"--memory-swap", fmt.Sprintf("%dm", spec.MemoryLimitMB+containerMemMarginMB), // 스왑 금지
		"--cpus", "1",
		"--pids-limit", fmt.Sprintf("%d", pidsLimit),
		"--read-only",
		"--tmpfs", "/tmp:size=16m",
		"--user", "65534:65534", // nobody — 비특권 실행
		"--security-opt", "no-new-privileges",
		"--cap-drop", "ALL",
		"-v", spec.WorkDir + ":/judge",
		"-e", fmt.Sprintf("CASE_COUNT=%d", spec.CaseCount),
		"-e", fmt.Sprintf("TIME_LIMIT_MS=%d", spec.TimeLimitMS),
		"-e", fmt.Sprintf("MEM_LIMIT_MB=%d", spec.MemoryLimitMB),
		pythonImage,
	}

	cmd := exec.CommandContext(runCtx, "docker", args...)
	var out strings.Builder
	cmd.Stdout = &out
	cmd.Stderr = &out

	err := cmd.Run()
	if runCtx.Err() != nil {
		// 예산 초과 — CommandContext는 docker CLI(클라이언트)만 죽이므로 컨테이너를 직접 킬.
		_ = exec.Command("docker", "kill", name).Run()
		return nil, fmt.Errorf("채점 예산(%s) 초과로 컨테이너 강제 종료", budget)
	}
	if err != nil {
		return nil, fmt.Errorf("컨테이너 실행 실패: %w\n%s", err, out.String())
	}

	data, err := os.ReadFile(filepath.Join(spec.WorkDir, "result.json"))
	if err != nil {
		return nil, fmt.Errorf("harness 결과 누락: %w\n%s", err, out.String())
	}
	var raws []domain.RawCaseResult
	if err := json.Unmarshal(data, &raws); err != nil {
		return nil, fmt.Errorf("harness 결과 파싱 실패: %w", err)
	}
	return raws, nil
}
