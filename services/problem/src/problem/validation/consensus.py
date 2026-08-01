"""합의 판정 — 순수 로직(실행기 주입).

judge의 aggregate() 교훈 재적용: 실행을 주입받으면 판정 로직이 파일시스템·
프로세스 없이 테스트된다.

판정 규칙(v1 — 예제 기반):
- 풀이가 '동의'한다 = 모든 예제에서 초안의 기대 출력과 일치.
- validated = 동의 풀이 수 ≥ quorum (기본: 과반 초과가 아니라 **전원에 가까운
  다수** — n=3이면 2. 합의 검증의 목적은 다수결 승자 찾기가 아니라 이상 신호
  탐지이므로 문턱을 낮게 잡지 않는다).
- 진단 신호: 풀이들끼리는 서로 일치하는데 초안 기대 출력과 다르면
  "초안의 예제 출력 오류 의심"을 사유에 남긴다 — 검수자가 가장 먼저 봐야 할 단서.
"""

from collections import Counter
from collections.abc import Callable

from problem.domain.models import ProblemDraft, SolutionRun, ValidationResult
from problem.validation.executor import normalize_output

RunFn = Callable[[str, str], str | None]  # (code, stdin) -> stdout | None


def default_quorum(n: int) -> int:
    return max(2, n - 1) if n >= 2 else 1


def validate_draft(
    run: RunFn, solutions: list[str], draft: ProblemDraft, quorum: int | None = None
) -> ValidationResult:
    quorum = quorum or default_quorum(len(solutions))
    expected = [normalize_output(ex.output) for ex in draft.examples]

    runs: list[SolutionRun] = []
    for code in solutions:
        outputs = [run(code, ex.input) for ex in draft.examples]
        normed = [normalize_output(o) if o is not None else None for o in outputs]
        runs.append(
            SolutionRun(outputs=normed, matched_expected=(normed == expected))
        )

    agreed = sum(1 for r in runs if r.matched_expected)
    reasons: list[str] = []

    if agreed < quorum:
        reasons.append(f"기대 출력 일치 풀이 {agreed}/{len(solutions)} < 정족수 {quorum}")
        # 진단: 예제별로 풀이들끼리의 최빈 출력이 기대와 다른데 다수라면 초안 오류 의심.
        for i, ex_expected in enumerate(expected):
            votes = Counter(
                r.outputs[i] for r in runs if r.outputs[i] is not None
            )
            if not votes:
                continue
            top, count = votes.most_common(1)[0]
            if top != ex_expected and count >= quorum:
                reasons.append(
                    f"예제 {i + 1}: 독립 풀이 {count}개가 기대와 다른 동일 출력에 합의 — 초안의 예제 출력 오류 의심"
                )

    failures = sum(1 for r in runs if any(o is None for o in r.outputs))
    if failures:
        reasons.append(f"실행 실패 풀이 {failures}개(에러·타임아웃)")

    return ValidationResult(
        solutions_total=len(solutions),
        solutions_agreed=agreed,
        validated=agreed >= quorum,
        reasons=reasons,
        runs=runs,
    )
