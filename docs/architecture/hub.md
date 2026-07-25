# hub 아키텍처 (Kotlin + Spring Boot)

- **관련 ADR**: [0007 백엔드 Kotlin 복귀](../decisions/0007-backend-kotlin-return.md) (0005 대체), [0006 서비스 이음새](../decisions/0006-service-seams-and-ai-consolidation.md)
- **상태**: Active (2026-07-25 Kotlin 재구현)
- **위치**: [`platform/hub/`](../../platform/hub/)

## 책임

유저·문제·제출·랭킹 등 플랫폼 비즈니스 로직과 데이터 접근. 실제 코드 채점은 하지 않는다 — 제출을 받아 (추후) Kafka로 judge에 넘기고 결과를 소비해 SSE로 arena에 푸시하는 **중심(hub)** 역할.

## 스택 (적재적소 근거는 ADR-0007)

Kotlin 2.2 · Spring Boot 4.0.x · **WebFlux + 코루틴**(suspend 핸들러) · **R2DBC**(논블로킹 Postgres) · **Flyway**(스키마 이관) · springdoc(OpenAPI) · Gradle Kotlin DSL · JDK 21 LTS

> **실무 재탕 금지 조항**: MVC·JPA·블로킹 스타일 금지. hub는 I/O bound 오케스트레이터(+추후 SSE·Kafka)라 논블로킹이 도메인 정합.

## Hexagonal 구조

의존 방향: **adapter → application → domain** (domain은 프레임워크 무의존).

```
platform/hub/src/main/kotlin/com/cotejs/hub/
├─ domain/
│  ├─ model/                  Problem·Example·Submission·NewSubmission,
│  │                          Difficulty/Language/JudgeResult(enum+label), ProblemNotFoundException
│  └─ port/
│     ├─ inbound/             ProblemQueries · SubmissionQueries · SubmitCode  (유스케이스 계약)
│     └─ outbound/            ProblemRepository · SubmissionRepository        (영속 계약)
├─ application/               ProblemService · SubmissionService (인바운드 포트 구현, 채점은 PENDING stub)
├─ adapter/
│  ├─ inbound/web/            suspend @RestController + DTO(응답 계약) + GlobalErrorHandler(404/400)
│  └─ outbound/persistence/   R2DBC 엔티티·CoroutineCrudRepository·도메인 매핑(JSONB↔Map, 배열↔List)
└─ config/                    CORS(WebFluxConfigurer)
```

- **DTO가 JSON 계약의 원본**: 응답 필드명·포맷(submittedAt `"YYYY-MM-DD HH:mm:ss"`, difficulty/language/result는 label 문자열)은 구 contracts와 동일 유지(drop-in). enum은 도메인이 소유하고 DTO 경계에서 label로 직렬화.
- **전역 prefix** `/api`는 `spring.webflux.base-path`.

## API (현행)

| 메서드 | 경로 | 응답 |
|---|---|---|
| GET | `/api/problems` | 문제 목록(id asc, examples 포함) |
| GET | `/api/problems/{id}` | 단건 · 없으면 404 |
| GET | `/api/submissions` | 제출 목록(최신순) |
| POST | `/api/submissions` | 201 생성("채점 중" stub) · 검증 실패 400 |
| GET | `/api/v3/api-docs` | OpenAPI 스펙(arena codegen 원천) |

## arena와의 계약 흐름

```
hub DTO → springdoc /v3/api-docs → (arena) pnpm gen:api → shared/api/schema.d.ts(커밋)
→ shared/api/contract-check.ts가 도메인 모델과 키 집합·타입 호환을 컴파일 타임 검사
→ 어긋나면 next build 실패 (계약 드리프트 조기 검출)
```

## 데이터

- 스키마·시드는 **Flyway가 소유**(`src/main/resources/db/migration/V1__schema.sql`, `V2__seed.sql`) — 기동 시 자동 적용. 상세: [data-model.md](data-model.md).
- 함정 기록: Flyway 플레이스홀더가 PG 달러 인용(`$tag${`)을 오인 → `placeholder-replacement: false` 필수.

## 다음 단계 (Judge 마일스톤 — ADR-0006 경로)

제출 시 Kafka 제출 토픽 발행 → judge 채점 → 결과 토픽 소비(코루틴 컨슈머) → DB 저장 + **SSE(Flow)** 로 arena 푸시. 인증/랭킹(Redis)·rate limit은 hub 후속 백로그.
