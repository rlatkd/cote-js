package domain

import "context"

// Runner는 언어별 실행기 포트. 샌드박스 어댑터(Docker — 추후 커널 직접 제어로 교체)가 구현한다.
//
// Compile 단계는 언어 추가(C++·Java)를 대비한 자리다 — 컴파일이 없는 언어(Python)는
// no-op으로 통과시킨다. 언어 추가 시 이 인터페이스는 불변, 러너만 추가한다(ADR-0009).
type Runner interface {
	// Compile은 실패해도 error를 반환하지 않는다 — 컴파일 실패는 유저 귀책(COMPILE_ERROR 판정)이고,
	// error는 시스템 장애(INTERNAL_ERROR)에만 쓴다.
	Compile(ctx context.Context, spec RunSpec) (CompileOutput, error)
	RunCases(ctx context.Context, spec RunSpec) ([]RawCaseResult, error)
}

// RunSpec은 러너에 넘기는 실행 명세. WorkDir 안에 소스와 케이스 입력이 준비돼 있다.
type RunSpec struct {
	// 소스·케이스 입력·출력이 배치된 작업 디렉토리(임시, 채점 후 폐기).
	//   main.py / cases/NN.in / out/NN.out(러너가 씀) / result.json(러너가 씀)
	WorkDir       string
	CaseCount     int
	TimeLimitMS   uint32
	MemoryLimitMB uint32
}

type CompileOutput struct {
	OK  bool
	Log string
}

// RawCaseResult는 러너(harness)가 보고하는 케이스별 원시 결과.
// 판정(Verdict) 부여는 executor의 몫 — 러너는 사실만 보고한다.
type RawCaseResult struct {
	No           int    `json:"no"`
	ExitCode     int    `json:"exit_code"`
	TimedOut     bool   `json:"timed_out"`
	MemExceeded  bool   `json:"mem_exceeded"`
	ExecTimeMS   uint32 `json:"time_ms"`
	MemoryUsedKB uint32 `json:"mem_kb"`
}
