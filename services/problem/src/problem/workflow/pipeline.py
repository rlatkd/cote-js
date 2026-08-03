"""파이프라인 지휘 — 생성 → 독립 풀이 → 실채점 → 합의 → 후보 (ADR-0006 ④: 지휘자=problem).

워크플로 엔진 없이 평범한 코드로 단계를 잇는다. LLM 호출(LangChain 동기)은
스레드로 내려 이벤트 루프(Kafka 하트비트)를 막지 않는다.

실패의 두 층위를 구분해 발행한다:
- 초안이 검증에서 떨어짐 → REJECTED 후보(관측 대상 — 생성 성공률)
- 파이프라인 자체가 실패(LLM 오류·judge 불능) → failure 후보(인프라 신호, 재시도 가능)
"""

import asyncio
import logging

from langchain_core.language_models.chat_models import BaseChatModel

from problem.generation.chain import generate_draft
from problem.messaging import translate
from problem.messaging.config import SOLVER_COUNT
from problem.v1 import candidate_pb2, generation_pb2
from problem.validation.consensus import evaluate_consensus
from problem.validation.judge_runner import JudgeRunner, JudgeUnavailable
from problem.validation.solver import generate_solutions

log = logging.getLogger(__name__)


async def handle_request(
    request: generation_pb2.GenerationRequest,
    model: BaseChatModel,
    runner: JudgeRunner,
    model_id: str,
    solver_count: int = SOLVER_COUNT,
) -> candidate_pb2.ProblemCandidate:
    trace = translate.child_trace(request.trace)
    params = translate.params_from_request(request)

    try:
        draft = await asyncio.to_thread(generate_draft, model, params)
        log.info(
            "초안 생성 request_id=%d title=%s trace_id=%s",
            request.request_id, draft.title, trace.trace_id,
        )
        solutions = await asyncio.to_thread(generate_solutions, model, draft, solver_count)
        outcomes = await runner.run_all(solutions, draft, trace)
    except JudgeUnavailable as e:
        log.error("judge 불능 request_id=%d trace_id=%s: %s", request.request_id, trace.trace_id, e)
        return translate.failure_candidate(
            request, trace, code="JUDGE_UNAVAILABLE", detail=str(e), retryable=True,
        )
    except Exception as e:  # noqa: BLE001 — LLM·파싱 실패는 종류가 많고 전부 같은 처치다
        log.error("생성 실패 request_id=%d trace_id=%s: %s", request.request_id, trace.trace_id, e)
        return translate.failure_candidate(
            request, trace, code="GENERATION_FAILED", detail=str(e), retryable=True,
        )

    validation = evaluate_consensus(outcomes, draft)
    log.info(
        "합의 판정 request_id=%d validated=%s agreed=%d/%d trace_id=%s",
        request.request_id, validation.validated,
        validation.solutions_agreed, validation.solutions_total, trace.trace_id,
    )
    return translate.candidate_from_validation(request, draft, validation, trace, model_id)
