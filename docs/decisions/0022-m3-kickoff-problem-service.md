# 0022. M3 착수 — api↔AI 계약(Protobuf/Kafka)·LLM 프로바이더 전략·problem 서비스 기반

- **상태**: Accepted
- **일자**: 2026-08-01

## 맥락 (Context)

데이터 라이선스([ADR-0021](0021-data-licensing.md))로 M3 선결 1건이 풀렸고, 남은 선결은 api↔AI 경계 계약이었다. judge 착수([ADR-0009](0009-judge-kickoff-async-and-contracts.md))와 같은 패턴으로 "착수 시 확정할 것만 확정하고, 나머지는 구현하며 검증"한다. 검증 파이프라인의 이론 골격은 engineering-notes '생성 문제 정답 신뢰성'(N개 독립 풀이 합의·brute-force 앵커·batch 실채점·stress testing 후보)에 정리돼 있다.

## 결정 (Decision)

1. **api↔problem 계약 = Protobuf over Kafka** (`contracts/proto/problem/v1`, 초안 Draft):
   - `problem.generate` (api→problem): 생성 요청 — request_id·난이도·태그·자유 지시.
   - `problem.candidate` (problem→api): 생성·자동검증을 마친 후보 — 본문+예제+히든 케이스(**인라인**, 케이스 대량화 시 judge와 같은 claim-check로 진화)+**ValidationReport**(풀이 합의 수·brute-force·judge 실채점 여부)+status(VALIDATED/REJECTED — 반려도 발행해 생성 성공률을 관측).
   - problem은 코어 DB 접근 금지 — api가 소비해 검수 큐 저장, admin 승인 후 게시(ADR-0006 단일 작성자 원칙).
2. **LLM 프로바이더 전략 (사용자 확정, 2026-08-01)**: 개발 단계는 **저가/무료 모델**(Gemini 무료 티어)로 배관을 뚫고, **주력 프로바이더는 생성 품질 단계에서 실측 비교 후 재결정**한다. 구현은 LangChain `init_chat_model` 뒤로 격리(`problem/llm/provider.py`) — 교체·병용(검증 다변화)이 설정 문제가 되게. **유료·키 발급이 걸린 선택은 사용자 결정 사항**(전 단계에서 Claude가 기본값을 깔았다가 지적받은 건의 재발 방지).
3. **problem 서비스 기반**: Python 3.13 + **uv**(패키지·가상환경) + FastAPI(운영 표면 최소) + LangChain 1.x + pytest. 내부 구조는 처리 단계 네이밍(ADR-0008): `generation`(체인)·`validation`(예정)·`workflow`(예정) + `domain`·`llm`.
4. **코드젠 템플릿 분리**: judge는 problem/v1의 소비자가 아니므로 기본 템플릿(`buf.gen.yaml`)에서 `proto/problem`을 제외하고, `buf.gen.problem.yaml`(api용 Java, 추후 problem용 Python)을 신설. CI 드리프트 검사는 두 템플릿 모두 실행.
5. **구조화 출력은 파서 방식(v0)**: PydanticOutputParser(JSON 지시+파싱) — 어떤 BaseChatModel로도 돌아 페이크 테스트가 가능. 네이티브 tool-calling 구조화는 품질 단계에서 재평가.

## 근거 (Rationale)

- 계약·전달 방식은 기존 확정의 연장이다: api↔AI도 Protobuf(ADR-0009 방침), 장시간 파이프라인(다회 LLM 호출+batch 채점)은 비동기가 적합하고 Kafka는 이미 있다.
- 반려(REJECTED)까지 발행하는 것은 "생성 성공률"이 M3의 핵심 운영 지표이기 때문 — 성공만 보내면 파이프라인이 얼마나 버려지는지 api가 볼 수 없다.
- uv·LangChain 1.x는 학습 가치(모던 파이썬 도구·표준 오케스트레이션)와 문제 적합성(폴리글랏 모노레포에서 서비스 자체 도구 소유 원칙) 모두 충족.

## 검토한 대안 (Alternatives)

- **HTTP(REST/gRPC) 요청-응답**: 생성은 수 분짜리 작업이라 동기 결합이 부적합. 배제.
- **problem이 검수 큐 DB에 직접 쓰기**: 스키마 단일 작성자 위반. 배제.
- **케이스 claim-check 즉시 도입**: 첫 슬라이스 케이스 수(수십)에선 인라인이 단순. 대량화(스트레스 테스트) 때 진화 — 계약 주석에 경로 명시.
- **네이티브 구조화 출력(with_structured_output)**: 프로바이더·페이크 간 지원 편차로 배관 단계에 부적합. 품질 단계 재평가.

## 결과 (Consequences)

- 남은 M3 선결 없음 — 다음 슬라이스는 validation 모듈(독립 풀이 생성→합의 판정), 그다음 Kafka 배선(python codegen 포함)·api 검수 큐·admin UI.
- 실호출은 사용자 액션 대기: **Gemini API 키 발급**(`GOOGLE_API_KEY`, `services/problem/.env` — gitignore 확인됨).
- protoc 버전 매트릭스를 35.1로 정렬(CI pin·로컬 brew·api protobuf-java 4.35.1) — 신규 macOS 개발 머신 합류로 드러난 어긋남.
- 이 판단이 뒤집히는 조건: 생성 파이프라인이 요청-응답형 상호작용(관리자와의 반복 수정 대화 등)을 요구하게 되면 HTTP 표면 재검토.
