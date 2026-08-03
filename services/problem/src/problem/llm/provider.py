"""LLM 프로바이더 격리 — 파이프라인은 이 팩토리 뒤의 모델만 안다.

프로바이더 결정(2026-08-01, 사용자 확정): 개발 단계는 저가/무료로 배관을 뚫고,
주력 프로바이더는 생성 품질 단계에서 실측 비교 후 재결정한다. 검증 설계의
모델 다변화(탈상관)까지 고려해, 어떤 프로바이더든 LangChain `BaseChatModel`로
주입 가능한 구조를 유지한다 — 교체·병용이 설정 문제가 되게.

OpenRouter(2026-08-03, 사용자 확정 — Gemini 계정 결제 이슈 우회 + 다변화):
집합소(aggregator)라 init_chat_model의 네이티브 프로바이더가 아니다 —
OpenAI 호환 엔드포인트로 접속하며, 모델 id는 OpenRouter 표기 그대로 쓴다.
    PROBLEM_LLM_MODEL=openrouter:qwen/qwen3-235b-a22b:free  (예시)
"""

import os

from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel

# 개발 단계 기본값 — 무료 티어가 있는 저가 모델. 주력 재결정 시 설정으로 바뀐다.
_DEV_DEFAULT_MODEL = "google_genai:gemini-flash-latest"

_OPENROUTER_PREFIX = "openrouter:"
_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def chat_model(model: str | None = None) -> BaseChatModel:
    """설정된 프로바이더의 채팅 모델을 만든다.

    `model`은 "provider:model" 형식(LangChain init_chat_model 규약).
    미지정 시 환경변수 PROBLEM_LLM_MODEL, 그것도 없으면 개발 기본값.
    자격 증명은 프로바이더별 표준 환경변수를 따른다(Gemini=GOOGLE_API_KEY,
    OpenRouter=OPENROUTER_API_KEY).
    """
    spec = model or os.environ.get("PROBLEM_LLM_MODEL", _DEV_DEFAULT_MODEL)
    if spec.startswith(_OPENROUTER_PREFIX):
        return _openrouter_model(spec.removeprefix(_OPENROUTER_PREFIX))
    return init_chat_model(spec)


def _openrouter_model(model_id: str) -> BaseChatModel:
    # 지연 import — OpenRouter를 안 쓰는 경로(테스트 포함)가 openai 패키지에 묶이지 않게.
    from langchain_openai import ChatOpenAI

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY가 없다 — services/problem/.env 확인")
    return ChatOpenAI(
        model=model_id,
        base_url=_OPENROUTER_BASE_URL,
        api_key=api_key,
        # 무료 티어 업스트림은 극단적으로 느리거나 걸릴 수 있다(550B 모델에서 19분+ 실측).
        # 무한 대기 대신 끊고 실패 층위(GENERATION_FAILED·retryable)로 올린다.
        timeout=180,
        max_retries=1,
    )
