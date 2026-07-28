package domain

import "context"

// Runner는 "격리된 환경에서 제출을 실행한다"는 포트. 샌드박스 어댑터(Docker — 추후
// 커널 직접 제어로 교체)가 구현한다. 경계를 여기 둔 이유는 **격리 방식은 바뀌지만
// 채점 절차는 바뀌지 않기** 때문이다.
//
// 초기엔 Compile/RunCases 두 메서드였으나 한 메서드로 합쳤다 — 컴파일과 실행을 나누면
// 컨테이너를 두 번 띄워야 하고(기동 비용 2배), 컴파일 산출물을 전달하려고 바인드 마운트
// 잔존에 의존하게 된다. 한 번의 실행 안에서 "검증 → 케이스 실행"이 끝나는 게 자연스럽다.
type Runner interface {
	Run(ctx context.Context, spec RunSpec) (RunOutcome, error)
}

// RunSpec은 러너에 넘기는 실행 명세. WorkDir 안에 소스와 케이스 입력이 준비돼 있다.
type RunSpec struct {
	// 소스·케이스 입력·출력이 배치된 작업 디렉토리(임시, 채점 후 폐기).
	//   <소스파일> / cases/NN.in / out/NN.out(러너가 씀) / compile.json · result.json(러너가 씀)
	WorkDir string
	// 언어 식별자 — 러너가 이미지·실행 명령을 고르는 키.
	Language  string
	CaseCount int
	// **보정이 적용된** 유효 한도(언어별 배수·여유분 반영. executor가 계산한다).
	TimeLimitMS   uint32
	MemoryLimitMB uint32
}

type RunOutcome struct {
	Compile CompileOutput
	// 컴파일 실패 시엔 비어 있다.
	Cases []RawCaseResult
}

// CompileOutput — 실행 전 검증(컴파일·문법 검사) 결과.
// 실패는 error가 아니다: 유저 귀책이므로 COMPILE_ERROR 판정으로 흐른다.
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
