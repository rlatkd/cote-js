"""수동 트리거 CLI — Kafka 배선 전, 생성 체인을 손으로 돌려보는 도구.

judge의 judgecli·judgeprobe와 같은 역할: 파이프라인을 경계 없이 단독 검증한다.

    uv run problem-generate --difficulty Silver --tags BFS
    (Gemini 키 필요: GOOGLE_API_KEY. services/problem/.env는 gitignore.)
"""

import argparse
import sys

from problem.domain.models import GenerationParams
from problem.generation.chain import generate_draft
from problem.llm.provider import chat_model


def main() -> None:
    ap = argparse.ArgumentParser(description="문제 초안 생성(수동 트리거)")
    ap.add_argument("--difficulty", required=True, help="예: Bronze / Silver / Gold")
    ap.add_argument("--tags", default="", help="쉼표 구분. 예: BFS,그래프 탐색")
    ap.add_argument("--instruction", default="", help="자유 서술 지시")
    ap.add_argument("--model", default=None, help='"provider:model" 오버라이드')
    args = ap.parse_args()

    params = GenerationParams(
        difficulty=args.difficulty,
        tags=[t.strip() for t in args.tags.split(",") if t.strip()],
        instruction=args.instruction,
    )
    draft = generate_draft(chat_model(args.model), params)
    sys.stdout.write(draft.model_dump_json(indent=2) + "\n")


if __name__ == "__main__":
    main()
