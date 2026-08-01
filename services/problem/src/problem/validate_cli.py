"""수동 검증 CLI — 생성된 초안(JSON)을 독립 풀이 합의로 검증한다.

    uv run --env-file .env problem-generate --difficulty Silver --tags BFS > draft.json
    uv run --env-file .env problem-validate draft.json --n 3
"""

import argparse
import pathlib
import sys

from problem.domain.models import ProblemDraft
from problem.llm.provider import chat_model
from problem.validation.consensus import validate_draft
from problem.validation.executor import run_python
from problem.validation.solver import generate_solutions


def main() -> None:
    ap = argparse.ArgumentParser(description="초안 합의 검증(수동 트리거)")
    ap.add_argument("draft", help="problem-generate가 출력한 초안 JSON 파일")
    ap.add_argument("--n", type=int, default=3, help="독립 풀이 수(기본 3)")
    ap.add_argument("--model", default=None, help='"provider:model" 오버라이드')
    args = ap.parse_args()

    draft = ProblemDraft.model_validate_json(pathlib.Path(args.draft).read_text())
    solutions = generate_solutions(chat_model(args.model), draft, args.n)
    result = validate_draft(run_python, solutions, draft)

    sys.stdout.write(result.model_dump_json(indent=2) + "\n")
    sys.exit(0 if result.validated else 1)


if __name__ == "__main__":
    main()
