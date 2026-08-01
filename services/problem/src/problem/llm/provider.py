"""LLM 프로바이더 격리 — 파이프라인은 이 팩토리 뒤의 모델만 안다.

프로바이더 결정(2026-08-01, 사용자 확정): 개발 단계는 저가/무료(Gemini 무료 티어)로
배관을 뚫고, 주력 프로바이더는 생성 품질 단계에서 실측 비교 후 재결정한다.
검증 설계의 모델 다변화(탈상관)까지 고려해, 어떤 프로바이더든 LangChain
`BaseChatModel`로 주입 가능한 구조를 유지한다 — 교체·병용이 설정 문제가 되게.
"""

import os

from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel

# 개발 단계 기본값 — 무료 티어가 있는 저가 모델. 주력 재결정 시 설정으로 바뀐다.
_DEV_DEFAULT_MODEL = "google_genai:gemini-flash-latest"


def chat_model(model: str | None = None) -> BaseChatModel:
    """설정된 프로바이더의 채팅 모델을 만든다.

    `model`은 "provider:model" 형식(LangChain init_chat_model 규약).
    미지정 시 환경변수 PROBLEM_LLM_MODEL, 그것도 없으면 개발 기본값.
    자격 증명은 프로바이더별 표준 환경변수를 따른다(Gemini=GOOGLE_API_KEY).
    """
    return init_chat_model(model or os.environ.get("PROBLEM_LLM_MODEL", _DEV_DEFAULT_MODEL))
