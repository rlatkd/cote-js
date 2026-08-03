"""검증 모듈 테스트 — 고정하는 불변식:

① 합의 판정은 순수 로직이다(실행 결과를 값으로 받는다 — Kafka·프로세스 없이 검증)
② '풀이 간 합의 ≠ 초안 일치'가 구분 보고된다(초안 예제 오류 진단)
③ 실행 실패는 불일치로 취급되고 사유에 남는다
④ 정규화·동일성 식별자는 judge의 비교 규칙과 같다(어긋나면 합의 전체가 무너진다)
⑤ JudgeResult → 식별자 매핑: 비교 가능 판정(AC·WA)만 값, 장애·컴파일 에러는 전 예제 실패
⑥ 번들 패킹은 결정적이고 judge가 기대하는 레이아웃(cases/NN.in|out)이다
⑦ 풀이 생성은 의도 풀이(solution_sketch)를 노출하지 않는다(독립성)
"""

import gzip
import hashlib
import io
import tarfile

from common.v1 import error_pb2
from judge.v1 import result_pb2
from problem.domain.models import IoPair, ProblemDraft
from problem.validation.bundle import bundle_ref, pack_bundle
from problem.validation.consensus import evaluate_consensus
from problem.validation.judge_runner import outcome_from_result
from problem.validation.normalize import normalize_output, output_identity
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


def _ids(*outputs: str | None) -> list[str | None]:
    """원문 → 동일성 식별자(테스트 가독용). None은 실행 실패 그대로."""
    return [output_identity(o) if o is not None else None for o in outputs]


def test_전원_일치면_validated():
    outcomes = [_ids("3", "12"), _ids("3\n", "12")]  # 후행 개행 정규화 확인
    result = evaluate_consensus(outcomes, _DRAFT)
    assert result.validated and result.solutions_agreed == 2 and not result.reasons


def test_풀이들이_초안과_다른_값에_합의하면_초안_오류_의심_사유():
    outcomes = [_ids("4", "12"), _ids("4", "12"), _ids("4", "12")]
    result = evaluate_consensus(outcomes, _DRAFT)
    assert not result.validated
    assert any("초안의 예제 출력 오류 의심" in r for r in result.reasons)


def test_실행_실패는_불일치이며_사유에_남는다():
    outcomes = [_ids("3", "12"), _ids(None, None)]
    result = evaluate_consensus(outcomes, _DRAFT)
    assert not result.validated  # 정족수 2 미달(동의 1)
    assert any("실행 실패" in r for r in result.reasons)


def test_출력_정규화는_judge_규칙과_같다():
    assert normalize_output("3 \n12\n\n") == "3\n12"
    assert normalize_output("3\r\n12\t\n") == "3\n12"  # CRLF·후행 탭 — judge normalize와 동일
    # 동일성 식별자 = 정규화 출력의 sha256(hex) — judge outputDigest의 재현 규칙
    assert output_identity("3 \n12\n\n") == hashlib.sha256(b"3\n12").hexdigest()


def test_judge_결과는_비교가능_판정만_식별자가_된다():
    result = result_pb2.JudgeResult(
        submission_id=-1,
        verdict=result_pb2.VERDICT_WRONG_ANSWER,
        cases=[
            result_pb2.CaseResult(no=1, verdict=result_pb2.VERDICT_ACCEPTED, output_sha256="aa"),
            result_pb2.CaseResult(no=2, verdict=result_pb2.VERDICT_WRONG_ANSWER, output_sha256="bb"),
            result_pb2.CaseResult(no=3, verdict=result_pb2.VERDICT_TIME_LIMIT_EXCEEDED),
        ],
    )
    assert outcome_from_result(result, 3) == ["aa", "bb", None]


def test_judge_장애와_컴파일_에러는_전_예제_실패():
    broken = result_pb2.JudgeResult(
        submission_id=-1,
        verdict=result_pb2.VERDICT_INTERNAL_ERROR,
        failure=error_pb2.Error(code="SANDBOX_DOWN"),
    )
    assert outcome_from_result(broken, 2) == [None, None]

    compile_error = result_pb2.JudgeResult(
        submission_id=-1, verdict=result_pb2.VERDICT_COMPILE_ERROR
    )
    assert outcome_from_result(compile_error, 2) == [None, None]


def test_번들_패킹은_결정적이고_judge_레이아웃이다():
    cases = [IoPair(input="1 2\n", output="3\n"), IoPair(input="5 7\n", output="12\n")]
    a, b = pack_bundle(cases), pack_bundle(cases)
    assert a == b  # 같은 케이스 집합 → 같은 바이트(콘텐츠 주소·judge 캐시의 전제)

    key, sha = bundle_ref(a)
    assert key == f"bundles/{sha}.tgz" and sha == hashlib.sha256(a).hexdigest()

    with tarfile.open(fileobj=io.BytesIO(gzip.decompress(a)), mode="r") as tar:
        names = sorted(tar.getnames())
        assert names == ["cases/01.in", "cases/01.out", "cases/02.in", "cases/02.out"]
        member = tar.extractfile("cases/02.out")
        assert member is not None and member.read() == b"12\n"


def test_풀이_프롬프트는_의도_풀이를_노출하지_않는다():
    rendered = SOLVER_PROMPT.format(
        title=_DRAFT.title, description=_DRAFT.description,
        input_spec=_DRAFT.input_spec, output_spec=_DRAFT.output_spec, examples="…",
    )
    assert "그냥 더한다" not in rendered  # solution_sketch 차단


def test_펜스_방어_제거():
    assert _strip_fence("```python\nprint(1)\n```") == "print(1)"
    assert _strip_fence("print(1)") == "print(1)"
