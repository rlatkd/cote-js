"""생성 체인 v0 — 파라미터 → LLM → 문제 초안(ProblemDraft).

구조화는 PydanticOutputParser(JSON 지시 + 파싱)로 한다. 네이티브 구조화 출력
(tool calling 기반 with_structured_output)이 더 견고하지만 프로바이더·페이크 간
지원 편차가 있어, 배관 단계에선 어떤 BaseChatModel로도 도는 파서 방식을 쓴다.
품질 단계(주력 프로바이더 재결정)에서 네이티브 방식 전환을 재평가한다.
"""

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.runnables import Runnable

from problem.domain.models import GenerationParams, ProblemDraft
from problem.generation.prompts import GENERATION_PROMPT

_parser = PydanticOutputParser(pydantic_object=ProblemDraft)


def build_generation_chain(model: BaseChatModel) -> Runnable:
    """모델을 주입받아 생성 체인을 만든다 — 프로바이더는 호출자가 정한다."""
    prompt = GENERATION_PROMPT.partial(format_instructions=_parser.get_format_instructions())
    return prompt | model | _parser


def generate_draft(model: BaseChatModel, params: GenerationParams) -> ProblemDraft:
    return build_generation_chain(model).invoke(
        {
            "difficulty": params.difficulty,
            "tags": ", ".join(params.tags) if params.tags else "(제한 없음)",
            "instruction": params.instruction or "(없음)",
        }
    )
