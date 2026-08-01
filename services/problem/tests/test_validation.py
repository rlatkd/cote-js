"""검증 모듈 테스트 — 고정하는 불변식:

① 합의 판정은 순수 로직이다(실행기 주입 — 프로세스 없이 검증)
② '풀이 간 합의 ≠ 초안 일치'가 구분 보고된다(초안 예제 오류 진단)
③ 실행 실패는 불일치로 취급되고 사유에 남는다
④ 실행기는 정상 출력/에러/타임아웃을 구분한다(실제 subprocess)
⑤ 풀이 생성은 의도 풀이(solution_sketch)를 노출하지 않는다(독립성)
"""

from problem.domain.models import GenerationParams, IoPair, ProblemDraft
from problem.validation.consensus import validate_draft
from problem.validation.executor import normalize_output, run_python
from problem.validation.solver import SOLVER_PROMPT, _strip_fence

_DRAFT = ProblemDraft(
    title="두 수 더하기",
    description="A와 B를 더한다",
    input_spec="A B",
    output_spec="합",
    difficulty="Bronze",
    tags=["구현"],
    time_limit_ms=1000,
    memory_limit_mb=256,
    examples=[IoPair(input="1 2", output="3"), IoPair(input="5 7", output="12")],
    solution_sketch="그냥 더한다",
)


def _fake_run(table: dict[tuple[str, str], str | None]):
    return lambda code, stdin: table[(code, stdin)]


def test_전원_일치면_validated():
    run = _fake_run({("s1", "1 2"): "3", ("s1", "5 7"): "12",
                     ("s2", "1 2"): "3\n", ("s2", "5 7"): "12"})  # 후행 개행 정규화 확인
    result = validate_draft(run, ["s1", "s2"], _DRAFT)
    assert result.validated and result.solutions_agreed == 2 and not result.reasons


def test_풀이들이_초안과_다른_값에_합의하면_초안_오류_의심_사유():
    run = _fake_run({("s1", "1 2"): "4", ("s1", "5 7"): "12",
                     ("s2", "1 2"): "4", ("s2", "5 7"): "12",
                     ("s3", "1 2"): "4", ("s3", "5 7"): "12"})
    result = validate_draft(run, ["s1", "s2", "s3"], _DRAFT)
    assert not result.validated
    assert any("초안의 예제 출력 오류 의심" in r for r in result.reasons)


def test_실행_실패는_불일치이며_사유에_남는다():
    run = _fake_run({("ok", "1 2"): "3", ("ok", "5 7"): "12",
                     ("bad", "1 2"): None, ("bad", "5 7"): None})
    result = validate_draft(run, ["ok", "bad"], _DRAFT)
    assert not result.validated  # 정족수 2 미달(동의 1)
    assert any("실행 실패" in r for r in result.reasons)


def test_실행기_정상_에러_타임아웃():
    assert run_python("print(int(input())*2)", "21") == "42\n"
    assert run_python("raise SystemExit(1)", "") is None
    assert run_python("while True: pass", "", timeout_s=0.5) is None


def test_출력_정규화는_judge_규칙과_같다():
    assert normalize_output("3 \n12\n\n") == "3\n12"


def test_풀이_프롬프트는_의도_풀이를_노출하지_않는다():
    rendered = SOLVER_PROMPT.format(
        title=_DRAFT.title, description=_DRAFT.description,
        input_spec=_DRAFT.input_spec, output_spec=_DRAFT.output_spec, examples="…",
    )
    assert "그냥 더한다" not in rendered  # solution_sketch 차단


def test_펜스_방어_제거():
    assert _strip_fence("```python\nprint(1)\n```") == "print(1)"
    assert _strip_fence("print(1)") == "print(1)"
