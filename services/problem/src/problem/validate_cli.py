"""수동 검증 CLI — 생성된 초안(JSON)을 독립 풀이 합의로 검증한다.

    uv run --env-file .env problem-generate --difficulty Silver --tags BFS > draft.json
    uv run --env-file .env problem-validate draft.json --n 3

실행 주체는 judge batch 레인이다(무격리 로컬 실행은 제거됨) — 인프라(Kafka·
MinIO)와 judged 워커가 떠 있어야 한다. LLM 없이 실행 경로만 볼 때는
--solutions 로 풀이 파일들을 직접 줄 수 있다(solver 생성 생략).
"""

import argparse
import asyncio
import pathlib
import sys

from problem.domain.models import ProblemDraft
from problem.llm.provider import chat_model
from problem.messaging.config import (
    JUDGE_TIMEOUT_S,
    KAFKA_BROKERS,
    MINIO_ACCESS_KEY,
    MINIO_BUCKET,
    MINIO_ENDPOINT,
    MINIO_SECRET_KEY,
)
from problem.validation.bundle import BundleStore
from problem.validation.consensus import evaluate_consensus
from problem.validation.judge_runner import JudgeRunner
from problem.validation.solver import generate_solutions


async def _validate(draft: ProblemDraft, solutions: list[str]) -> bool:
    store = BundleStore(MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET)
    runner = JudgeRunner(store, brokers=KAFKA_BROKERS, timeout_s=JUDGE_TIMEOUT_S)
    await runner.start()
    try:
        outcomes = await runner.run_all(solutions, draft)
    finally:
        await runner.stop()

    result = evaluate_consensus(outcomes, draft)
    sys.stdout.write(result.model_dump_json(indent=2) + "\n")
    return result.validated


def main() -> None:
    ap = argparse.ArgumentParser(description="초안 합의 검증(수동 트리거 — judge 실채점)")
    ap.add_argument("draft", help="problem-generate가 출력한 초안 JSON 파일")
    ap.add_argument("--n", type=int, default=3, help="독립 풀이 수(기본 3)")
    ap.add_argument("--model", default=None, help='"provider:model" 오버라이드')
    ap.add_argument(
        "--solutions", nargs="+", default=None,
        help="풀이 파일 경로들 — 지정 시 LLM 생성을 생략(실행 경로 단독 검증용)",
    )
    args = ap.parse_args()

    draft = ProblemDraft.model_validate_json(pathlib.Path(args.draft).read_text(encoding="utf-8"))
    if args.solutions:
        solutions = [pathlib.Path(p).read_text(encoding="utf-8") for p in args.solutions]
    else:
        solutions = generate_solutions(chat_model(args.model), draft, args.n)

    sys.exit(0 if asyncio.run(_validate(draft, solutions)) else 1)


if __name__ == "__main__":
    main()
