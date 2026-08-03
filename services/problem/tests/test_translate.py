"""경계 번역 테스트 — 고정하는 불변식:

① 검증 반려(REJECTED)와 파이프라인 실패(failure)는 다른 신호다 — 섞이면
   생성 성공률 관측이 인프라 장애에 오염된다
② 후보는 요청과 request_id로 상관된다
③ 추적은 부모 흐름을 이어받고(trace_id 불변) 자기 스팬을 새로 딴다
"""

from common.v1 import trace_pb2
from problem.domain.models import IoPair, ProblemDraft, ValidationResult
from problem.messaging.translate import (
    candidate_from_validation,
    child_trace,
    failure_candidate,
    params_from_request,
)
from problem.v1 import candidate_pb2, generation_pb2

_REQUEST = generation_pb2.GenerationRequest(
    request_id=42,
    difficulty="Silver",
    tags=["BFS", "그래프 탐색"],
    instruction="격자 소재로",
    trace=trace_pb2.TraceContext(trace_id="a" * 32, span_id="b" * 16),
)

_DRAFT = ProblemDraft(
    title="t", description="d", input_spec="i", output_spec="o",
    difficulty="Silver", tags=["BFS"], time_limit_ms=1000, memory_limit_mb=256,
    examples=[IoPair(input="1", output="2")], solution_sketch="s",
)


def test_요청_파라미터_운반():
    params = params_from_request(_REQUEST)
    assert params.difficulty == "Silver"
    assert params.tags == ["BFS", "그래프 탐색"]
    assert params.instruction == "격자 소재로"


def test_자식_추적은_흐름을_잇고_스팬을_새로_딴다():
    child = child_trace(_REQUEST.trace)
    assert child.trace_id == "a" * 32  # 흐름 불변
    assert child.parent_span_id == "b" * 16
    assert child.span_id and child.span_id != "b" * 16

    # 부모가 비면(수동 프로브) 새 흐름이 시작된다
    fresh = child_trace(trace_pb2.TraceContext())
    assert len(fresh.trace_id) == 32 and fresh.parent_span_id == ""


def _validation(validated: bool) -> ValidationResult:
    return ValidationResult(
        solutions_total=3, solutions_agreed=3 if validated else 1,
        validated=validated, reasons=[] if validated else ["기대 출력 일치 풀이 1/3 < 정족수 2"],
    )


def test_검증_통과는_VALIDATED_반려는_REJECTED():
    trace = child_trace(_REQUEST.trace)
    ok = candidate_from_validation(_REQUEST, _DRAFT, _validation(True), trace, "m")
    assert ok.status == candidate_pb2.CANDIDATE_STATUS_VALIDATED
    assert ok.request_id == 42 and not ok.HasField("failure")
    assert ok.validation.judge_verified  # 실행 주체가 judge라 합의 통과 = 실채점 통과
    assert ok.title == "t" and len(ok.examples) == 1

    rejected = candidate_from_validation(_REQUEST, _DRAFT, _validation(False), trace, "m")
    assert rejected.status == candidate_pb2.CANDIDATE_STATUS_REJECTED
    assert not rejected.HasField("failure")  # 반려는 실패가 아니다 — 관측 대상
    assert "정족수" in rejected.validation.notes


def test_파이프라인_실패는_반려와_구분된다():
    trace = child_trace(_REQUEST.trace)
    failed = failure_candidate(_REQUEST, trace, code="JUDGE_UNAVAILABLE", detail="timeout", retryable=True)
    assert failed.status == candidate_pb2.CANDIDATE_STATUS_UNSPECIFIED
    assert failed.HasField("failure")
    assert failed.failure.code == "JUDGE_UNAVAILABLE" and failed.failure.retryable
