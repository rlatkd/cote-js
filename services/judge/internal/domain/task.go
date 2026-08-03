// Package domain — judge의 핵심 모델. 전송(Kafka)·저장소(MinIO)·샌드박스(Docker)와 무관하다.
package domain

// Verdict 값은 contracts/proto/judge/v1/result.proto 의 Verdict enum과 1:1 대응한다.
type Verdict string

const (
	VerdictAccepted            Verdict = "ACCEPTED"
	VerdictWrongAnswer         Verdict = "WRONG_ANSWER"
	VerdictCompileError        Verdict = "COMPILE_ERROR"
	VerdictRuntimeError        Verdict = "RUNTIME_ERROR"
	VerdictTimeLimitExceeded   Verdict = "TIME_LIMIT_EXCEEDED"
	VerdictMemoryLimitExceeded Verdict = "MEMORY_LIMIT_EXCEEDED"
	// 채점 시스템 자체 장애(샌드박스 기동 실패 등) — 유저 귀책이 아니므로 구분.
	VerdictInternalError Verdict = "INTERNAL_ERROR"
)

// Task는 채점 1건의 입력. BundleDir는 테스트케이스 번들이 풀린 로컬 경로 —
// claim-check(MinIO) 어댑터가 다운로드·캐시 후 채워 주며, CLI에서는 직접 지정한다.
type Task struct {
	SubmissionID  int64
	Language      string
	SourceCode    string
	TimeLimitMS   uint32
	MemoryLimitMB uint32
	BundleDir     string
}

type CaseResult struct {
	No           int
	Verdict      Verdict
	ExecTimeMS   uint32
	MemoryUsedKB uint32
	// 정규화된 실제 출력의 sha256(hex). 출력이 존재하는 판정(AC·WA)에서만 채워진다 —
	// problem의 합의 검증이 출력 동일성을 원문 노출 없이 비교하는 데 쓴다(계약 주석 참조).
	OutputSHA256 string
}

type JudgeResult struct {
	SubmissionID int64
	// 종합 판정 — 첫 실패 케이스의 판정(모두 통과 시 ACCEPTED).
	Verdict Verdict
	// 종합 수치 — 케이스 최대값.
	ExecTimeMS   uint32
	MemoryUsedKB uint32
	Cases        []CaseResult
	// COMPILE_ERROR·INTERNAL_ERROR 상세. 그 외엔 빈 문자열.
	ErrorMessage string
}
