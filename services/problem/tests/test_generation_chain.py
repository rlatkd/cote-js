"""생성 체인 구조 테스트 — LLM 없이(페이크로) 배관을 검증한다.

선별적 TDD(ADR-0016): 여기서 고정하는 불변식은
① 체인이 어떤 BaseChatModel로도 돌아 초안(ProblemDraft)을 낸다(프로바이더 격리)
② 파라미터가 프롬프트에 실제로 실린다(운반 누락 검출)
③ 스키마에 안 맞는 LLM 출력은 조용히 통과되지 않고 실패한다(파싱이 검증을 겸함)
LLM 출력의 '품질'은 여기서 검증하지 않는다 — 그건 validation 모듈의 일이다.
"""

import json

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.exceptions import OutputParserException

from problem.domain.models import GenerationParams, ProblemDraft
from problem.generation.chain import build_generation_chain, generate_draft
from problem.generation.prompts import GENERATION_PROMPT

_DRAFT_JSON = json.dumps(
    {
        "title": "물류 창고의 최단 경로",
        "description": "격자 창고에서 로봇이 짐을 나른다…",
        "input_spec": "첫째 줄에 N, M (1 ≤ N, M ≤ 1,000)",
        "output_spec": "최단 이동 횟수를 출력한다.",
        "difficulty": "Silver",
        "tags": ["BFS"],
        "time_limit_ms": 1000,
        "memory_limit_mb": 256,
        "examples": [{"input": "2 2\n..\n..", "output": "2"}],
        "solution_sketch": "BFS로 최단 거리를 구한다.",
    },
    ensure_ascii=False,
)


def test_페이크_모델로_초안이_생성된다():
    model = FakeListChatModel(responses=[_DRAFT_JSON])
    draft = generate_draft(
        model, GenerationParams(difficulty="Silver", tags=["BFS"], instruction="")
    )
    assert isinstance(draft, ProblemDraft)
    assert draft.title == "물류 창고의 최단 경로"
    assert draft.time_limit_ms == 1000
    assert draft.examples[0].output == "2"


def test_파라미터가_프롬프트에_실린다():
    messages = GENERATION_PROMPT.partial(format_instructions="(형식)").invoke(
        {"difficulty": "Gold", "tags": "BFS, 비트마스킹", "instruction": "격자 소재"}
    ).to_messages()
    human = messages[-1].content
    assert "Gold" in human
    assert "비트마스킹" in human
    assert "격자 소재" in human


def test_스키마_불일치_출력은_실패한다():
    # 필수 필드(title 등)가 빠진 JSON — 조용히 넘어가면 안 된다.
    model = FakeListChatModel(responses=[json.dumps({"title": "만"})])
    chain = build_generation_chain(model)
    with pytest.raises(OutputParserException):
        chain.invoke({"difficulty": "Silver", "tags": "BFS", "instruction": "(없음)"})


def test_openrouter_스펙은_호환_엔드포인트로_향한다(monkeypatch):
    # 집합소(OpenRouter)는 init_chat_model 네이티브가 아니라 OpenAI 호환 접속 —
    # 프리픽스 파싱·base_url·모델 id 보존을 고정한다(키는 페이크, 네트워크 없음).
    from problem.llm.provider import chat_model

    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    model = chat_model("openrouter:qwen/qwen3-235b-a22b:free")
    assert model.model_name == "qwen/qwen3-235b-a22b:free"  # ":free" 접미사까지 보존
    assert "openrouter.ai" in str(model.openai_api_base)

    monkeypatch.delenv("OPENROUTER_API_KEY")
    with pytest.raises(ValueError, match="OPENROUTER_API_KEY"):
        chat_model("openrouter:any/model")
