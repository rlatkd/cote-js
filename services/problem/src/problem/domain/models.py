"""도메인 모델 — 생성 파이프라인이 다루는 값의 형태.

계약(contracts/proto/problem/v1)과 어휘를 맞추되, 여기는 파이프라인 내부 표현이다.
경계(Kafka)로 나갈 때 proto로 번역한다(배선 슬라이스에서) — 내부 모델을 경계에
직접 노출하지 않는 것은 api의 DTO/도메인 분리와 같은 원칙.
"""

from pydantic import BaseModel, Field


class IoPair(BaseModel):
    input: str
    output: str


class GenerationParams(BaseModel):
    """생성 요청 파라미터 — proto GenerationRequest의 내부 대응물."""

    difficulty: str = Field(description="예: Bronze / Silver / Gold")
    tags: list[str] = Field(default_factory=list)
    instruction: str = Field(default="", description="관리자의 자유 서술 지시")


class SolutionRun(BaseModel):
    """풀이 하나의 예제별 실행 결과.

    identities: 예제 순서대로의 **출력 동일성 식별자**(정규화 출력의 sha256 hex).
    원문이 아니라 식별자인 이유: 실행 주체가 judge(batch 레인)라 결과 토픽에는
    출력 원문이 실리지 않고 해시만 온다(judge/v1 CaseResult.output_sha256).
    합의 판정에 필요한 것은 동일성 비교뿐이므로 식별자로 충분하다.
    None = 실행 실패(에러·타임아웃·시스템 장애).
    """

    identities: list[str | None]
    matched_expected: bool  # 모든 예제에서 초안의 기대 출력과 일치했는가


class ValidationResult(BaseModel):
    """합의 검증 판정 — proto ValidationReport의 내부 대응물.

    핵심 구분: '풀이들끼리의 합의'와 '초안 기대 출력과의 일치'는 다른 신호다.
    풀이들이 서로 일치하는데 초안과 다르면 → 초안의 예제 출력이 틀렸을 가능성이
    높다(생성 모델의 자답 오류). 둘을 분리 보고해야 반려 사유가 진단이 된다.
    """

    solutions_total: int
    solutions_agreed: int  # 초안 기대 출력과 전 예제 일치한 풀이 수
    validated: bool
    reasons: list[str] = Field(default_factory=list)  # 반려·경고 사유(검수자용)
    runs: list[SolutionRun] = Field(default_factory=list)


class ProblemDraft(BaseModel):
    """LLM이 생성한 문제 초안 — 검증 전 상태.

    검증(validation 모듈)을 통과해야 후보(candidate)가 된다. 필드 설명은
    LLM 구조화 출력의 스키마 힌트로도 쓰이므로 생성 관점에서 서술한다.
    """

    title: str = Field(description="문제 제목 — 간결한 한국어 명사구")
    description: str = Field(description="지문(markdown). 문제 상황과 요구를 완결적으로 서술")
    input_spec: str = Field(description="입력 형식 — 줄 단위 구성과 값 범위(제약)를 명시")
    output_spec: str = Field(description="출력 형식 — 유일한 정답이 나오도록 명시")
    difficulty: str = Field(description="요청된 난이도를 그대로")
    tags: list[str] = Field(description="알고리즘 분류 태그")
    time_limit_ms: int = Field(description="시간 제한(ms) — 의도 풀이 실측의 여유 배수로")
    memory_limit_mb: int = Field(description="메모리 제한(MB)")
    examples: list[IoPair] = Field(description="공개 예제 2~3개 — 지문 이해를 돕는 대표 케이스")
    solution_sketch: str = Field(
        description="의도한 풀이의 핵심 아이디어 요약 — 검증 단계의 독립 풀이와 대조용"
    )
