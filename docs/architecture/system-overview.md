# 시스템 개요

전체 구성 다이어그램의 원본은 [/README.md](../../README.md) 2장. 여기서는 서비스 책임과 데이터 흐름을 요약한다. 서비스 간 이음새 규칙(결과 경로·DB 소유권·QoS·지휘자·검수 UI·Redis)은 [ADR-0006](../decisions/0006-service-seams-and-ai-consolidation.md)이 원본.

## 서비스 구성

> 서비스 폴더명 = 역할 도메인 용어([ADR-0003](../decisions/0003-monorepo-structure.md)). AI는 setter/scout 2분할([ADR-0006](../decisions/0006-service-seams-and-ai-consolidation.md) — 당초 3분할에서 tester를 setter 내부 모듈로 병합).

| 서비스(폴더) | 기술 | 책임 |
|---|---|---|
| arena | Next.js | 문제 조회·풀이·제출 UI, 채점 결과·랭킹 (+ 추후 admin 검수 큐) |
| hub | TypeScript + NestJS + Prisma | 회원·인증, 문제·제출·랭킹 비즈니스 로직, 결과 소비·SSE 푸시, admin API |
| setter | Python + FastAPI + LLM API/LangChain | 문제 생성 + 품질 검증(정답 교차검증, 내부 `tester` 모듈) + **파이프라인 지휘** |
| scout | Python + FastAPI + 자체 임베딩 | 기존 문제와 유사도 판정(pgvector) — 모델 상주 서빙이라 독립 |
| judge | Go + Docker Sandbox | 제출 코드 격리 실행·채점. **DB 접근 금지, 이벤트만 발행** |

## 저장소와 소유권 (단일 작성자 원칙)

**스키마당 주인 하나** — 교차 접근은 API/이벤트로만.

| 저장소 | 영역 | 주인 |
|---|---|---|
| PostgreSQL | 코어(회원·문제·제출·랭킹) | hub (Prisma) |
| PostgreSQL + pgvector | 임베딩 | scout |
| PostgreSQL | 출제 파이프라인(초안·검증·검수 상태) | setter |
| Redis | ① 제출 rate limiting ② 랭킹 리더보드(sorted set) ③ SSE 팬아웃 pub/sub | hub |
| Kafka | 제출·결과 토픽 (QoS 3레인) | — |

## 두 갈래 데이터 흐름

### 1) 문제 생성·검증 파이프라인 (오프라인) — 지휘자 = setter

```
데이터셋 → setter.generate(LLM) → scout 질의(유사도/pgvector)
        → setter.validate(정답 교차검증 — judge batch 레인 재사용)
        → 사람 검수 게이트(arena admin + hub admin API) → 승인 시 hub로 공개 이관
```

핵심: 자동 검증만으로 공개하지 않는다. **정답 교차검증 + 사람 검수**를 통과해야 문제 DB에 노출. 파이프라인 상태머신은 setter가 소유(워크플로 엔진 미도입).

### 2) 사용자 제출·채점 (온라인) — 결과는 이벤트로 회귀

```
arena 제출 → hub(rate limit) → Kafka 제출 토픽 → judge
judge: Docker Sandbox 실행 → 판정 → Kafka 결과 토픽
hub: 결과 소비 → DB 저장 → SSE로 arena 실시간 푸시
```

- **judge는 DB에 쓰지 않는다** — 결과 이벤트만 발행(폴리글랏 스키마 공유 금지).
- 실행 요청은 **QoS 3레인**: `run`(예제 실행, 인터랙티브 저지연) / `submit`(정식 제출) / `batch`(setter 검증, 최저 우선순위). 배치가 유저 제출을 굶기지 않는다.
- 샌드박스 격리(seccomp/cgroups/네트워크 차단)는 필수 — Judge 착수 시 보안 노트로 상세화.

## 마일스톤과의 관계

전체를 한 번에 만들지 않고 M1~M5로 세로 슬라이스 구현([TODO](../TODO.md)). 현재: arena(Next) + hub(NestJS) + Postgres가 연결돼 문제·제출을 실제 DB에서 서빙(채점은 stub, Judge 마일스톤 예정). 사람 검수 UI(arena admin + hub admin API)는 M3 범위.
