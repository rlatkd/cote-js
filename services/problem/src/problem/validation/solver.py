"""독립 풀이 생성 — 검증의 재료.

독립성의 핵심: 풀이 모델에게 **지문만** 준다. 초안의 `solution_sketch`(출제
모델의 의도 풀이)를 노출하면 같은 접근을 복제해 합의가 검증이 아니라 반향이
된다. 예제는 준다 — 응시자도 보는 공개 정보라 독립성을 해치지 않는다.

언어는 Python 단독으로 시작한다(로컬 실행기 단순화). judge batch 배선 시
언어 다변화를 재검토한다.
"""

import re

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from problem.domain.models import ProblemDraft

SOLVER_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "너는 알고리즘 문제 풀이자다. 주어진 문제를 Python 3로 푼다.\n"
            "규칙:\n"
            "- 표준입력(stdin)에서 읽고 표준출력(stdout)으로만 출력할 것.\n"
            "- 코드만 출력할 것 — 설명·주석·마크다운 펜스 금지.\n"
            "- 입력 제약을 그대로 신뢰하고 방어 코드는 넣지 말 것.",
        ),
        (
            "human",
            "## {title}\n\n{description}\n\n### 입력\n{input_spec}\n\n"
            "### 출력\n{output_spec}\n\n### 예제\n{examples}",
        ),
    ]
)

_FENCE = re.compile(r"^```(?:python)?\s*\n|\n?```\s*$", re.MULTILINE)


def _strip_fence(text: str) -> str:
    """모델이 규칙을 어기고 마크다운 펜스를 둘렀을 때 대비한 방어적 제거."""
    return _FENCE.sub("", text).strip()


def _render_examples(draft: ProblemDraft) -> str:
    return "\n\n".join(
        f"입력:\n{ex.input}\n출력:\n{ex.output}" for ex in draft.examples
    )


def generate_solutions(model: BaseChatModel, draft: ProblemDraft, n: int) -> list[str]:
    """지문만으로 독립 풀이 n개를 생성한다(호출 간 상태 공유 없음)."""
    chain = SOLVER_PROMPT | model | StrOutputParser() | _strip_fence
    inputs = {
        "title": draft.title,
        "description": draft.description,
        "input_spec": draft.input_spec,
        "output_spec": draft.output_spec,
        "examples": _render_examples(draft),
    }
    return [chain.invoke(inputs) for _ in range(n)]
