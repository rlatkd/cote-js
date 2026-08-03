"""개발용 주입기 — api 없이 생성 요청을 발행하고 후보를 지켜본다(judgeprobe 대응물).

    uv run problem-probe --difficulty Silver --tags BFS          # 발행 + 후보 대기
    uv run problem-probe --difficulty Silver --tags BFS --no-watch

api의 admin API가 생기면 정식 발행자는 api가 된다 — 이 도구는 경계(Kafka 계약)를
단독 검증하기 위한 개발 장비로 남는다.
"""

import argparse
import asyncio
import secrets
import sys
import time

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from google.protobuf import text_format
from google.protobuf.timestamp_pb2 import Timestamp

from common.v1 import trace_pb2
from problem.messaging.config import KAFKA_BROKERS, TOPIC_CANDIDATE, TOPIC_GENERATE
from problem.v1 import candidate_pb2, generation_pb2


async def _run(args: argparse.Namespace) -> int:
    request_id = args.request_id or -int(time.time())  # 프로브 요청도 음수 id — 코어와 구분
    requested_at = Timestamp()
    requested_at.GetCurrentTime()
    request = generation_pb2.GenerationRequest(
        request_id=request_id,
        difficulty=args.difficulty,
        tags=[t.strip() for t in args.tags.split(",") if t.strip()],
        instruction=args.instruction,
        requested_at=requested_at,
        trace=trace_pb2.TraceContext(
            trace_id=secrets.token_hex(16), span_id=secrets.token_hex(8)
        ),
    )

    watcher: AIOKafkaConsumer | None = None
    if args.watch:
        # 발행 전에 latest로 붙어 둔다 — 발행 후에 붙으면 후보를 놓칠 수 있다.
        watcher = AIOKafkaConsumer(
            TOPIC_CANDIDATE, bootstrap_servers=KAFKA_BROKERS,
            group_id=None, auto_offset_reset="latest", enable_auto_commit=False,
        )
        await watcher.start()

    producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BROKERS)
    await producer.start()
    try:
        await producer.send_and_wait(
            TOPIC_GENERATE, request.SerializeToString(), key=str(request_id).encode()
        )
        print(f"발행: request_id={request_id} trace_id={request.trace.trace_id}")
    finally:
        await producer.stop()

    if watcher is None:
        return 0

    try:
        async with asyncio.timeout(args.timeout):
            async for record in watcher:
                candidate = candidate_pb2.ProblemCandidate.FromString(record.value)
                if candidate.request_id != request_id:
                    continue
                print(text_format.MessageToString(candidate, as_utf8=True))
                status = candidate_pb2.CandidateStatus.Name(candidate.status)
                print(f"후보 수신: status={status} trace_id={candidate.trace.trace_id}")
                return 0 if candidate.status == candidate_pb2.CANDIDATE_STATUS_VALIDATED else 1
    except TimeoutError:
        print(f"후보 대기 시간 초과({args.timeout:.0f}s) — 워커 기동 여부 확인", file=sys.stderr)
        return 2
    finally:
        await watcher.stop()
    return 2


def main() -> None:
    ap = argparse.ArgumentParser(description="생성 요청 주입 + 후보 관찰(개발용)")
    ap.add_argument("--difficulty", required=True, help="예: Bronze / Silver / Gold")
    ap.add_argument("--tags", default="", help="쉼표 구분. 예: BFS,그래프 탐색")
    ap.add_argument("--instruction", default="", help="자유 서술 지시")
    ap.add_argument("--request-id", type=int, default=None, help="미지정 시 -epoch초")
    ap.add_argument("--timeout", type=float, default=600.0, help="후보 대기 상한(초)")
    ap.add_argument("--no-watch", dest="watch", action="store_false", help="발행만 하고 종료")
    args = ap.parse_args()
    sys.exit(asyncio.run(_run(args)))


if __name__ == "__main__":
    main()
