"""경계 번역 — proto ↔ 내부 모델(ACL). 내부 모델을 경계에 직접 노출하지 않는다.

api의 DTO/도메인 분리, judge의 toProto와 같은 원칙: 번역은 순수 함수로 모아
Kafka 없이 테스트한다.
"""

import secrets

from google.protobuf.timestamp_pb2 import Timestamp

from common.v1 import error_pb2, trace_pb2
from problem.domain.models import GenerationParams, ProblemDraft, ValidationResult
from problem.v1 import candidate_pb2, generation_pb2


def params_from_request(request: generation_pb2.GenerationRequest) -> GenerationParams:
    return GenerationParams(
        difficulty=request.difficulty,
        tags=list(request.tags),
        instruction=request.instruction,
    )


def child_trace(parent: trace_pb2.TraceContext) -> trace_pb2.TraceContext:
    """부모 흐름을 이어받아 이 구간의 스팬을 새로 딴다(ADR-0017·W3C 형식).

    부모가 비어 있으면(수동 프로브 등) 여기서 새 흐름이 시작된다 — trace_id 발급.
    """
    trace_id = parent.trace_id or secrets.token_hex(16)
    return trace_pb2.TraceContext(
        trace_id=trace_id,
        span_id=secrets.token_hex(8),
        parent_span_id=parent.span_id,
    )


def _now() -> Timestamp:
    ts = Timestamp()
    ts.GetCurrentTime()
    return ts


def _report(validation: ValidationResult, notes: str) -> candidate_pb2.ValidationReport:
    return candidate_pb2.ValidationReport(
        solutions_total=validation.solutions_total,
        solutions_agreed=validation.solutions_agreed,
        brute_force_checked=False,  # validation 2차(brute-force 앵커)에서 채워진다
        # 실행 주체가 judge batch 레인이므로, 합의 통과 = 대표 풀이가 실채점으로
        # 전 케이스(현 단계 = 공개 예제) 통과와 동치다.
        judge_verified=validation.validated,
        notes=notes,
    )


def candidate_from_validation(
    request: generation_pb2.GenerationRequest,
    draft: ProblemDraft,
    validation: ValidationResult,
    trace: trace_pb2.TraceContext,
    model_id: str,
) -> candidate_pb2.ProblemCandidate:
    """검증을 마친 초안 → 후보. REJECTED도 발행한다(생성 성공률 관측 — 계약 주석)."""
    status = (
        candidate_pb2.CANDIDATE_STATUS_VALIDATED
        if validation.validated
        else candidate_pb2.CANDIDATE_STATUS_REJECTED
    )
    notes_parts = [
        f"모델={model_id}",
        f"검증 범위=공개 예제 {len(draft.examples)}개(히든 케이스는 validation 2차)",
        *validation.reasons,
    ]
    message = candidate_pb2.ProblemCandidate(
        request_id=request.request_id,
        status=status,
        title=draft.title,
        description=draft.description,
        input_spec=draft.input_spec,
        output_spec=draft.output_spec,
        difficulty=draft.difficulty,
        tier="",  # 티어 어휘는 api가 진실원 — 검수 게이트에서 부여
        tags=draft.tags,
        time_limit_ms=draft.time_limit_ms,
        memory_limit_mb=draft.memory_limit_mb,
        examples=[
            candidate_pb2.IoPair(input=ex.input, output=ex.output) for ex in draft.examples
        ],
        # hidden_cases: 비움 — 합의 출력을 정답으로 채택하는 히든 생성은 validation 2차
        validation=_report(validation, "; ".join(notes_parts)),
        generated_at=_now(),
        trace=trace,
    )
    return message


def failure_candidate(
    request: generation_pb2.GenerationRequest,
    trace: trace_pb2.TraceContext,
    code: str,
    detail: str,
    retryable: bool,
) -> candidate_pb2.ProblemCandidate:
    """파이프라인 자체의 실패(LLM 오류·judge 불능 등) — 초안의 반려(REJECTED)와
    구분한다. 반려로 기록하면 생성 성공률 관측이 인프라 장애에 오염된다."""
    return candidate_pb2.ProblemCandidate(
        request_id=request.request_id,
        status=candidate_pb2.CANDIDATE_STATUS_UNSPECIFIED,
        failure=error_pb2.Error(
            code=code,
            message="문제 생성 파이프라인 실패",
            origin=error_pb2.FAULT_ORIGIN_PROVIDER,
            retryable=retryable,
            detail=detail,
        ),
        generated_at=_now(),
        trace=trace,
    )
