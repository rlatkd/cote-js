"""생성 프롬프트 — 문제 초안 생성 체인의 지시문.

few-shot 예시(외부 공개셋 참고)는 라이선스 실확인 후 별도 슬라이스에서 붙인다
(ADR-0021 — 내부 이용 한정). 지금은 zero-shot + 형식 지시만.
"""

from langchain_core.prompts import ChatPromptTemplate

# 출력 형식 지시({format_instructions})는 파서가 주입한다 — 스키마 진실원은
# 도메인 모델(ProblemDraft) 하나다.
GENERATION_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "너는 온라인 저지의 알고리즘 문제 출제자다. 요구 조건에 맞는 "
            "새 문제를 한국어로 출제한다.\n"
            "규칙:\n"
            "- 기존 유명 문제(백준·프로그래머스·LeetCode 등)를 복제하거나 "
            "번안하지 말 것. 소재와 서사를 새로 만들 것.\n"
            "- 정답 출력이 유일하도록 출력 형식을 설계할 것(복수 정답·"
            "부동소수점 비교가 필요한 문제 금지).\n"
            "- 입력 제약(범위)을 지문에 수치로 명시할 것. 제약은 의도 풀이는 "
            "통과하고 전수탐색은 시간 초과가 나도록 변별력 있게 잡을 것.\n"
            "- 예제는 지문만 읽고 손으로 따라갈 수 있는 크기로.\n"
            "{format_instructions}",
        ),
        (
            "human",
            "난이도: {difficulty}\n"
            "알고리즘 태그: {tags}\n"
            "추가 지시: {instruction}",
        ),
    ]
)
