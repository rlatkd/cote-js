# problem — AI 문제 생성·검증 파이프라인 (Python)

> 착수: 2026-08-01 ([ADR-0022](../decisions/0022-m3-kickoff-problem-service.md)). 이 문서는 구현 진행에 따라 갱신한다.

## 책임

**문제 제작 공정** — 생성(LLM)·검증(자동)·후보 발행까지. 게시는 하지 않는다(검수·게시는 api admin — [ADR-0006](../decisions/0006-service-seams-and-ai-consolidation.md)). 코어 DB 접근 금지.

핵심 원리(learning-notes 'AI 플랫폼에서 AI는 런타임 경로에 없다'): AI의 산출물은 검증을 거쳐 **데이터로 물화**되고, 유저 채점 경로에는 LLM이 없다.

## 경계

| 방향 | 수단 | 내용 |
|---|---|---|
| api → problem | Kafka `problem.generate` (Protobuf [problem/v1](../../contracts/proto/problem/v1/generation.proto)) | 생성 요청(난이도·태그·지시) |
| problem → api | Kafka `problem.candidate` ([candidate.proto](../../contracts/proto/problem/v1/candidate.proto)) | 검증 리포트 포함 후보. VALIDATED=검수 큐 대상, REJECTED=성공률 관측용 |
| problem → judge | Kafka `submission.batch` (judge/v1, 예정) | 독립 풀이 실채점 — batch 레인이 검증 트래픽 자리(ADR-0006) |

## 내부 구조 (처리 단계 네이밍 — ADR-0008)

```
src/problem/
├─ domain/        # GenerationParams · ProblemDraft(생성 초안, pydantic)
├─ llm/           # 프로바이더 격리 — init_chat_model 팩토리. 개발=저가(Gemini 무료 티어),
│                 # 주력은 품질 단계 재결정(사용자 확정 2026-08-01). 다변화(탈상관) 대비 주입 구조
├─ generation/    # 생성 체인 v0: 프롬프트 | 모델 | PydanticOutputParser
├─ validation/    # 1차 구현(2026-08-01): solver(독립 풀이 — 지문만 노출, solution_sketch 차단)
│                 # + executor(로컬 subprocess — ⚠️임시, judge batch로 대체 예정)
│                 # + consensus(순수 판정 — 실행기 주입, '풀이 간 합의 vs 초안 일치' 분리 진단)
│                 # 2차 예정: brute-force 앵커·히든 케이스 생성·stress testing
├─ workflow/      # (예정) 파이프라인 지휘(생성→검증→발행) — 워크플로 엔진 미도입(ADR-0006)
├─ cli.py         # 수동 트리거(judgecli 대응물): uv run problem-generate
└─ app.py         # FastAPI — 현재 /health만
```

- 도구: Python 3.13 + **uv**(lock이 버전 진실원) + LangChain 1.x + pytest.
- 테스트: 페이크 모델로 배관 불변식만(프로바이더 격리·파라미터 운반·스키마 불일치 실패) — LLM 품질은 테스트 대상 아님(ADR-0016).
- 코드젠: `buf.gen.problem.yaml`(전용 템플릿 — judge 오염 방지). Python 생성은 Kafka 배선 슬라이스에서.

## 지문 생성 규칙 (프롬프트에 강제, ADR-0021 연동)

기존 문제 복제·번안 금지 / 정답 유일 출력 설계(special judge 회피) / 제약 수치 명시 + 전수탐색 변별력 / few-shot 예시는 라이선스 실확인 후 도입.
