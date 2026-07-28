package executor

import (
	"strings"
	"testing"

	"github.com/rlatkd/cotejs/services/judge/internal/domain"
	"github.com/rlatkd/cotejs/services/judge/internal/language"
)

// 출력 비교는 채점의 정확도를 직접 결정한다 — "관대함의 정도"가 곧 정책이라
// 경계를 테스트로 못 박는다(거짓 오답과 거짓 정답 중 무엇을 감수하는지의 선언).
func TestOutputMatches(t *testing.T) {
	cases := []struct {
		name     string
		got      string
		expected string
		want     bool
	}{
		{"완전 일치", "3\n", "3\n", true},
		{"말미 개행 없음", "3", "3\n", true},
		{"말미 빈 줄 여러 개", "3\n\n\n", "3\n", true},
		{"CRLF", "3\r\n", "3\n", true},
		{"줄별 후행 공백", "1 2  \n3\t\n", "1 2\n3\n", true},
		{"값이 다름", "4\n", "3\n", false},
		{"줄 구조가 다름 — 공백을 전부 무시하면 안 된다", "1 2\n", "1\n2\n", false},
		{"중간 공백은 의미가 있다", "12\n", "1 2\n", false},
		{"빈 출력 vs 값", "", "3\n", false},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := outputMatches(c.got, c.expected); got != c.want {
				t.Errorf("outputMatches(%q, %q) = %v, want %v", c.got, c.expected, got, c.want)
			}
		})
	}
}

// 판정 우선순위는 순서를 잘못 두면 조용히 오분류된다
// (시간 초과로 죽은 프로세스는 exit code도 비정상이라 RE로 보일 수 있다).
func TestAggregateVerdictPriority(t *testing.T) {
	cases := []struct {
		name string
		raw  domain.RawCaseResult
		want domain.Verdict
	}{
		{
			name: "시간 초과가 런타임 에러보다 우선",
			raw:  domain.RawCaseResult{No: 1, TimedOut: true, ExitCode: 137},
			want: domain.VerdictTimeLimitExceeded,
		},
		{
			name: "메모리 초과가 런타임 에러보다 우선",
			raw:  domain.RawCaseResult{No: 1, MemExceeded: true, ExitCode: 1},
			want: domain.VerdictMemoryLimitExceeded,
		},
		{
			name: "비정상 종료는 런타임 에러",
			raw:  domain.RawCaseResult{No: 1, ExitCode: 1},
			want: domain.VerdictRuntimeError,
		},
	}

	e := New(nil)
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			// 출력 파일이 없는 상태 = 비교 이전 단계에서 판정이 갈려야 한다.
			got := e.aggregate(
				domain.Task{SubmissionID: 1},
				t.TempDir(),
				[]bundleCase{{input: "x", expected: "y"}},
				[]domain.RawCaseResult{c.raw},
			)
			if got.Verdict != c.want {
				t.Errorf("verdict = %v, want %v", got.Verdict, c.want)
			}
			if len(got.Cases) != 1 || got.Cases[0].Verdict != c.want {
				t.Errorf("케이스별 판정이 종합과 어긋남: %+v", got.Cases)
			}
		})
	}
}

// 종합 판정은 "첫 실패"이고, 케이스는 끝까지 남아야 한다
// (학습 플랫폼이라 "몇 번에서 틀렸나"가 사용자 가치 — 대회형처럼 중단하지 않는다).
func TestAggregateKeepsAllCasesAndTakesFirstFailure(t *testing.T) {
	e := New(nil)
	result := e.aggregate(
		domain.Task{SubmissionID: 7},
		t.TempDir(),
		[]bundleCase{{}, {}, {}},
		[]domain.RawCaseResult{
			{No: 1, ExitCode: 0, ExecTimeMS: 10, MemoryUsedKB: 100},
			{No: 2, ExitCode: 1, ExecTimeMS: 20, MemoryUsedKB: 300}, // 첫 실패
			{No: 3, TimedOut: true, ExecTimeMS: 30, MemoryUsedKB: 200},
		},
	)

	if result.Verdict != domain.VerdictRuntimeError {
		t.Errorf("종합 판정 = %v, want %v (첫 실패)", result.Verdict, domain.VerdictRuntimeError)
	}
	if len(result.Cases) != 3 {
		t.Fatalf("케이스 수 = %d, want 3 (첫 실패 후에도 계속 실행)", len(result.Cases))
	}
	// 종합 수치는 케이스 최대값
	if result.ExecTimeMS != 30 || result.MemoryUsedKB != 300 {
		t.Errorf("종합 수치 = %dms/%dKB, want 30ms/300KB", result.ExecTimeMS, result.MemoryUsedKB)
	}
}

// 러너가 케이스 결과를 빠뜨리면 조용히 통과시키면 안 된다(시스템 장애로 드러내야 한다).
func TestAggregateMissingCaseIsInternalError(t *testing.T) {
	e := New(nil)
	result := e.aggregate(
		domain.Task{SubmissionID: 1},
		t.TempDir(),
		[]bundleCase{{}, {}},
		[]domain.RawCaseResult{{No: 1, ExitCode: 0}}, // 2번 누락
	)
	if result.Verdict != domain.VerdictInternalError {
		t.Errorf("verdict = %v, want INTERNAL_ERROR", result.Verdict)
	}
}

// 시간 한도 보정 — 문제의 제한은 C/C++ 기준이라 느린 런타임엔 배수를 준다.
// 이 값이 바뀌면 정상 풀이가 TLE로 떨어질 수 있어 회귀를 막는다.
func TestEffectiveTimeLimit(t *testing.T) {
	for _, id := range language.Supported() {
		spec, err := language.Lookup(id)
		if err != nil {
			t.Fatalf("Lookup(%q) 실패: %v", id, err)
		}
		if spec.TimeFactor < 1 {
			t.Errorf("%s: TimeFactor=%v — 보정은 1 이상이어야 한다(제한을 줄이면 안 됨)", id, spec.TimeFactor)
		}
		if got := effectiveTimeLimit(1000, spec); got < 1000 {
			t.Errorf("%s: 유효 한도 %dms — 원 제한보다 작다", id, got)
		}
	}
}

// 미지원 언어는 **명시적으로 실패**해야 한다.
// (옛 구현은 언어를 무시하고 Python으로 실행해 다른 언어 제출을 런타임 에러로 오판정했다)
func TestUnsupportedLanguageIsRejected(t *testing.T) {
	if _, err := language.Lookup("cpp"); err == nil {
		t.Fatal("미지원 언어인데 통과했다 — 오판정 위험")
	}
	for _, id := range []string{"python", "java", "javascript"} {
		if _, err := language.Lookup(id); err != nil {
			t.Errorf("지원 언어 %q가 거부됨: %v", id, err)
		}
	}
}

// 언어 명세의 불변식 — 러너를 추가할 때 빠뜨리기 쉬운 항목을 강제한다.
func TestLanguageSpecInvariants(t *testing.T) {
	for _, id := range language.Supported() {
		spec, _ := language.Lookup(id)
		if spec.Image == "" || spec.SourceFile == "" || len(spec.RunCmd) == 0 {
			t.Errorf("%s: 이미지·소스파일·실행명령은 필수", id)
		}
		if spec.MemoryMode == language.MemoryRuntimeFlag {
			// 런타임 힙 옵션 방식인데 치환 토큰이 없으면 한도가 적용되지 않는다.
			found := false
			for _, arg := range spec.RunCmd {
				if strings.Contains(arg, language.MemPlaceholder) {
					found = true
				}
			}
			if !found {
				t.Errorf("%s: MemoryRuntimeFlag인데 RunCmd에 %s가 없다 — 메모리 한도가 안 걸린다",
					id, language.MemPlaceholder)
			}
		}
		if spec.MemoryMode == language.MemoryRuntimeFlag && spec.OOMSignature == "" {
			t.Errorf("%s: OOM 시그니처가 없으면 MLE를 런타임 에러로 오판정한다", id)
		}
	}
}
