"""judge batch 레인 실채점 러너 — 무격리 로컬 실행(구 executor.py)의 대체.

LLM이 생성한 풀이는 신뢰할 수 없는 코드다 — 유저 제출과 같은 경계(judge의
Docker 샌드박스)에서 실행한다. ADR-0006이 batch 레인을 검증 트래픽 자리로
설계해 둔 그대로, problem은 judge의 **소비자**가 된다(신규 실행 인프라 없음).

동작: 예제(입력+초안 기대 출력)를 claim-check 번들로 발행 → 풀이마다
judge/v1 Submission을 `submission.batch`에 발행 → `submission.result`에서
자기 제출의 결과를 상관 수집 → 케이스별 output_sha256을 동일성 식별자로 반환.

id 공간: 검증 제출은 **음수 submission_id**를 쓴다(계약 주석 참조) — 코어 DB
시퀀스(양수)와 충돌하지 않고, api 결과 컨슈머는 미지 제출을 스킵하므로 공존한다.

결과 컨슈머는 **컨슈머 그룹 없이 latest에서 시작**한다. 그룹을 쓰면 워커 인스턴스가
여러 개일 때 결과가 다른 인스턴스로 로드밸런싱돼 자기 제출의 결과를 놓친다 —
이 소비는 "내 요청의 응답 수집"이지 작업 분배가 아니다(pub/sub, api의 SSE 허브와 동류).
"""

import asyncio
import logging
import secrets

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from google.protobuf.timestamp_pb2 import Timestamp

from common.v1 import trace_pb2
from judge.v1 import result_pb2, submission_pb2
from problem.domain.models import ProblemDraft
from problem.messaging.config import (
    KAFKA_BROKERS,
    TOPIC_SUBMISSION_BATCH,
    TOPIC_SUBMISSION_RESULT,
)
from problem.validation.bundle import BundleStore, pack_bundle
from problem.validation.consensus import SolveOutcome

log = logging.getLogger(__name__)

# 검증 풀이의 언어 — solver가 Python 코드를 생성한다(언어 다변화는 후속 재검토).
_LANGUAGE = "python"

# 출력이 존재해 동일성 비교가 가능한 판정. 그 외(TLE·RE·MLE 등)는 실행 실패(None).
_COMPARABLE = {result_pb2.VERDICT_ACCEPTED, result_pb2.VERDICT_WRONG_ANSWER}


class JudgeUnavailable(Exception):
    """제한 시간 안에 judge 결과가 오지 않았다 — 초안의 결함이 아니라 인프라 문제.

    반려(REJECTED)로 기록하면 생성 성공률 관측이 오염되므로 구분해 올린다
    (호출자는 candidate.failure로 발행 — retryable).
    """


def outcome_from_result(result: result_pb2.JudgeResult, case_count: int) -> SolveOutcome:
    """JudgeResult → 예제별 동일성 식별자. 순수 함수(테스트는 proto 값만으로).

    시스템 장애(failure·INTERNAL_ERROR)와 컴파일 에러는 전 예제 실패로 취급한다 —
    합의 관점에서 "이 풀이는 어떤 예제에도 답하지 못했다"와 같다.
    """
    if result.HasField("failure") or result.verdict in (
        result_pb2.VERDICT_INTERNAL_ERROR,
        result_pb2.VERDICT_COMPILE_ERROR,
    ):
        return [None] * case_count

    by_no: dict[int, result_pb2.CaseResult] = {c.no: c for c in result.cases}
    return [
        (case.output_sha256 or None)
        if (case := by_no.get(no)) is not None and case.verdict in _COMPARABLE
        else None
        for no in range(1, case_count + 1)
    ]


def _validation_submission_id() -> int:
    """음수 id — 63비트 난수라 동시 검증 간 충돌 확률은 무시 가능하다."""
    return -(secrets.randbits(62) + 1)


class JudgeRunner:
    """풀이 묶음을 batch 레인으로 실채점하고 예제별 식별자를 돌려준다."""

    def __init__(
        self,
        store: BundleStore,
        brokers: str = KAFKA_BROKERS,
        timeout_s: float = 180.0,
    ) -> None:
        self._store = store
        self._brokers = brokers
        self._timeout_s = timeout_s
        self._producer: AIOKafkaProducer | None = None
        self._consumer: AIOKafkaConsumer | None = None
        self._watch_task: asyncio.Task | None = None
        self._pending: dict[int, asyncio.Future[result_pb2.JudgeResult]] = {}

    async def start(self) -> None:
        self._producer = AIOKafkaProducer(bootstrap_servers=self._brokers)
        await self._producer.start()
        # 그룹 없음 + latest: 우리가 발행한 제출의 결과만 필요하다(모듈 주석 참조).
        self._consumer = AIOKafkaConsumer(
            TOPIC_SUBMISSION_RESULT,
            bootstrap_servers=self._brokers,
            group_id=None,
            auto_offset_reset="latest",
            enable_auto_commit=False,
        )
        await self._consumer.start()
        self._watch_task = asyncio.create_task(self._watch_results())

    async def stop(self) -> None:
        if self._watch_task:
            self._watch_task.cancel()
            try:
                await self._watch_task
            except asyncio.CancelledError:
                pass
        if self._consumer:
            await self._consumer.stop()
        if self._producer:
            await self._producer.stop()

    async def _watch_results(self) -> None:
        assert self._consumer is not None
        async for record in self._consumer:
            try:
                result = result_pb2.JudgeResult.FromString(record.value)
            except Exception:  # noqa: BLE001 — poison message는 건너뛴다
                log.warning("결과 메시지 파싱 실패 — 건너뜀 offset=%s", record.offset)
                continue
            future = self._pending.pop(result.submission_id, None)
            if future is not None and not future.done():
                future.set_result(result)
            # 미지 id는 다른 소비자(api·다른 워커)의 몫 — 조용히 지나간다.

    async def run_all(
        self,
        solutions: list[str],
        draft: ProblemDraft,
        trace: trace_pb2.TraceContext | None = None,
    ) -> list[SolveOutcome]:
        """풀이 전부를 동시 발행하고 결과를 기다린다. 시간 내 미도착 → JudgeUnavailable."""
        assert self._producer is not None, "start()를 먼저 호출해야 한다"

        archive = pack_bundle(draft.examples)
        key, sha = await asyncio.to_thread(self._store.publish, archive)

        submitted_at = Timestamp()
        submitted_at.GetCurrentTime()

        futures: list[asyncio.Future[result_pb2.JudgeResult]] = []
        ids: list[int] = []
        for code in solutions:
            sid = _validation_submission_id()
            message = submission_pb2.Submission(
                submission_id=sid,
                problem_id=0,  # 아직 코어 문제가 아니다 — 초안 검증 트래픽
                language=_LANGUAGE,
                source_code=code,
                time_limit_ms=draft.time_limit_ms,
                memory_limit_mb=draft.memory_limit_mb,
                test_bundle_key=key,
                test_bundle_sha256=sha,
                submitted_at=submitted_at,
            )
            if trace is not None:
                message.trace.CopyFrom(trace)
            future: asyncio.Future[result_pb2.JudgeResult] = asyncio.get_running_loop().create_future()
            self._pending[sid] = future
            futures.append(future)
            ids.append(sid)
            await self._producer.send_and_wait(
                TOPIC_SUBMISSION_BATCH, message.SerializeToString(), key=str(sid).encode()
            )

        log.info("검증 제출 발행 count=%d bundle=%s", len(ids), sha[:12])
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*futures), timeout=self._timeout_s
            )
        except TimeoutError as e:
            for sid in ids:
                self._pending.pop(sid, None)
            raise JudgeUnavailable(
                f"judge 결과 대기 시간 초과({self._timeout_s:.0f}s) — 워커 기동 여부 확인"
            ) from e

        case_count = len(draft.examples)
        return [outcome_from_result(r, case_count) for r in results]
