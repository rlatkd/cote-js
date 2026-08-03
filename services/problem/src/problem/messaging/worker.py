"""problem 워커 데몬 — `problem.generate`를 소비해 파이프라인을 돌리고
`problem.candidate`를 발행한다(judge의 judged 대응물).

    uv run --env-file .env problem-worker

전달 보장: 생성 요청은 **수동 커밋 at-least-once**(처리·발행을 마친 뒤 커밋 —
커밋 전에 죽으면 재수행된다. LLM 재호출 비용은 들지만 요청 유실보다 낫고,
중복 후보는 api가 request_id로 흡수한다). poison message는 커밋하고 넘긴다.

LLM 호출이 느리므로(초안+풀이 N개 = 수십 초~분) max_poll_interval을 넉넉히
잡는다 — 기본값(5분)이면 처리 중 그룹에서 쫓겨나 같은 요청이 재분배된다.
"""

import asyncio
import logging

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

from problem.llm.provider import chat_model
from problem.messaging.config import (
    GROUP_GENERATE,
    JUDGE_TIMEOUT_S,
    KAFKA_BROKERS,
    MINIO_ACCESS_KEY,
    MINIO_BUCKET,
    MINIO_ENDPOINT,
    MINIO_SECRET_KEY,
    TOPIC_CANDIDATE,
    TOPIC_GENERATE,
)
from problem.v1 import generation_pb2
from problem.validation.bundle import BundleStore
from problem.validation.judge_runner import JudgeRunner
from problem.workflow.pipeline import handle_request

log = logging.getLogger(__name__)


async def run(model_id: str | None = None) -> None:
    model = chat_model(model_id)
    resolved_model = model_id or "(기본 모델 — llm/provider 참조)"

    store = BundleStore(MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET)
    runner = JudgeRunner(store, brokers=KAFKA_BROKERS, timeout_s=JUDGE_TIMEOUT_S)
    await runner.start()

    consumer = AIOKafkaConsumer(
        TOPIC_GENERATE,
        bootstrap_servers=KAFKA_BROKERS,
        group_id=GROUP_GENERATE,
        enable_auto_commit=False,
        auto_offset_reset="earliest",
        max_poll_interval_ms=1_800_000,  # LLM 파이프라인 1건의 상한(30분)
    )
    producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BROKERS)
    await consumer.start()
    await producer.start()
    log.info("problem 워커 기동 topic=%s group=%s", TOPIC_GENERATE, GROUP_GENERATE)

    try:
        async for record in consumer:
            try:
                request = generation_pb2.GenerationRequest.FromString(record.value)
            except Exception:  # noqa: BLE001 — poison message
                log.warning("생성 요청 파싱 실패 — 건너뜀 offset=%s", record.offset)
                await consumer.commit()
                continue

            log.info(
                "생성 요청 수신 request_id=%d difficulty=%s tags=%s trace_id=%s",
                request.request_id, request.difficulty,
                ",".join(request.tags), request.trace.trace_id,
            )
            candidate = await handle_request(request, model, runner, resolved_model)
            await producer.send_and_wait(
                TOPIC_CANDIDATE,
                candidate.SerializeToString(),
                key=str(request.request_id).encode(),
            )
            log.info(
                "후보 발행 request_id=%d status=%s trace_id=%s",
                request.request_id, candidate.status, candidate.trace.trace_id,
            )
            # 후보 발행까지 마친 뒤 커밋 — at-least-once의 경계가 여기다.
            await consumer.commit()
    finally:
        await consumer.stop()
        await producer.stop()
        await runner.stop()


def main() -> None:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
    )
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        log.info("종료 신호 — 워커 내려감")


if __name__ == "__main__":
    main()
