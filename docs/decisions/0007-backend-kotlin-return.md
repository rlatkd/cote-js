# 0007. 백엔드 Kotlin+Spring 복귀 — 모던 스택 제약 + OpenAPI 계약

- **상태**: Accepted
- **일자**: 2026-07-25
- **대체**: [ADR-0005](0005-backend-language-and-type-sharing.md) (Superseded)
> **명칭 노트(2026-07-25)**: 이후 [ADR-0008](0008-service-naming-and-group.md)로 서비스명이 개편됨 — arena→web, hub→api, setter→problem, scout→plagiarism, tester→problem의 validation 단계, judge 유지. 본문은 당시 명칭 그대로다(원문 동결 원칙).
>
> **강도 보충(2026-07-26, 사용자 확인)**: 본문의 **"실무 재탕 금지 조항"은 Claude가 규칙화한 문구로 사용자 의도보다 경직됐다.** 실제 방침은 *"실무와 겹치는 선택은 학습 가치가 낮아 기본 회피하되, **판단 순위는 기술적 적합성이 위** — 적합성이 명확하면 실무 스택도 채택(근거 명시)"*. **결정 자체는 유지**된다: 이 ADR의 각 선택(WebFlux+코루틴·R2DBC·Hexagonal)은 실무 회피가 아니라 독립적 기술 근거(api = I/O 지배 오케스트레이터 + SSE 푸시 주체, 논블로킹 스택 일관성)로 성립하므로 완화해도 뒤집히지 않는다. 결정 변경이 아니라 근거 강도 조정이므로 새 ADR 없이 이 노트로 갈음한다.

## 맥락

[0005]는 "사용자 실무가 Java+Spring → Kotlin+Spring은 학습 신규성 최저"를 근거로 NestJS를 채택하고 구현까지 마쳤다. 그러나 별도 세션에서 사용자가 Kotlin을 재론했고, 다음 재반박이 성립했다:

> **0005의 전제는 "실무 스타일 그대로(MVC+JPA+블로킹+레이어드) 재탕할 때"만 참이다.** 실무에서 안 쓰는 모던 Kotlin 스택(코루틴·WebFlux·R2DBC·Hexagonal)으로 강제하면 학습 신규성은 오히려 NestJS(구조적으로 Spring의 TS 번역본 — DI·모듈·데코레이터)보다 크다.

또한 "구현은 전적으로 Claude 담당"(CLAUDE.md)이므로 Kotlin의 VSCode DX 마찰은 의사결정 기준에서 배제된다(원칙 1). 한국 백엔드 시장에서 Kotlin+Spring의 포트폴리오 가치도 우세.

## 결정

### 1. hub = Kotlin + Spring Boot, 단 **모던 스택 강제** (실무 재탕 금지 조항)

| 선택 | 적재적소 근거 | 배제 |
|---|---|---|
| **WebFlux + 코루틴** (suspend 핸들러) | hub는 I/O bound 오케스트레이터(DB·추후 Kafka/judge/AI 호출)이자 SSE 푸시 주체 — 논블로킹+`Flow`가 도메인 정합(ADR-0006의 SSE와 연결) | Spring MVC(블로킹, 실무 재탕) |
| **R2DBC** | 논블로킹 스택 일관성 + JPA는 실무 반복이라 학습 0 | JPA/Hibernate |
| **Flyway** | 스키마 버전 관리 표준, 기동 시 자동 마이그레이션 | Prisma migrate(NestJS와 폐기) |
| **Hexagonal** (domain/port ↔ application ↔ adapter) | 원래 CLAUDE.md 잠정안. 포트/어댑터를 프레임워크 없이 직접 세움 — arena의 레이어드+ESLint 강제와 대칭 서사 | 실무식 3-layer |
| **Gradle (Kotlin DSL)** | Kotlin 생태계 표준 (사용자 지시) | Maven |
| springdoc-openapi | 계약(/v3/api-docs) 자동 생성 — 아래 2의 원천 | 수기 스펙 |

### 2. 계약: contracts(TS 공유) → **OpenAPI codegen + 컴파일 타임 계약 체크**

짝 A(0005)의 타입 공유는 폴리글랏 경계에서 불가 → 폐기. 대체:

```
hub(Kotlin) → springdoc /v3/api-docs → openapi-typescript(pnpm gen:api)
→ arena/shared/api/schema.d.ts (생성물 커밋)
→ shared/api/contract-check.ts: 도메인 모델 ↔ 스키마의 키 집합 일치 + 타입 호환을
  타입 레벨로 검사 → 어긋나면 next build 실패
```

- arena 도메인 모델(`entities/*/model.ts`)은 로컬 소유로 복원(리터럴 유니온 등 프론트 표현력 유지).
- 이 방식이 폴리글랏 회사의 실무 표준 관행이라 포트폴리오 가치도 있음.

### 3. 버전 정책: **LTS/안정판 기준** (전역 규칙화)

- JDK **21** (LTS — 최신 25가 아니라 성숙 LTS를 선택), Spring Boot **4.0.7** (최신 마이너 4.1.0 대신 성숙한 4.0.x 패치선), Kotlin 2.2(Boot BOM 페어링), Node 22 LTS, Postgres 16.
- 원칙: "최신이 무조건 좋은 것은 아니다" — 최신 메이저/마이너 첫 릴리스는 피하고 패치가 쌓인 선을 고른다.

### 4. Docker는 **개발용 = 인프라만**

- compose에는 인프라(Postgres, 이후 Redis·Kafka)만. 앱(hub·arena)은 호스트 네이티브 실행(핫리로드·디버거).
- 앱 컨테이너화(Dockerfile)는 배포 마일스톤(M5)에서 재도입 — 이번에 작성했던 앱 Dockerfile은 제거.

### 5. 폴더: hub는 `platform/hub` ([0003](0003-monorepo-structure.md) 재개정 — platform = 전 서비스 그룹)

## 검토한 대안 (배제)

- **NestJS 유지**: 구현 실물이 있었으나(매몰비용), Spring 경험자에게 신규성이 낮고 사용자 의사가 Kotlin. 코드는 git 히스토리에 보존.
- **Go 통합(api+judge)**: front↔api 계약 이득이 없고, 무거운 도메인 CRUD에 Go 적합성 약함. judge는 Go 유지.
- **Kotlin + MVC/JPA**: 0005의 반박("실무 재탕")이 그대로 성립 → 금지 조항으로 명문화.

## 구현 결과 (2026-07-25 검증)

- `platform/hub` — hexagonal 4계층, suspend 컨트롤러, R2DBC(+JSONB·배열 매핑), Flyway V1 스키마+V2 시드(구 prisma seed 이관).
- curl 검증: GET problems(7)·단건·404 / GET submissions(10) / POST 201(동일 응답 계약)·400(검증·잘못된 enum) / OpenAPI 200. 기동 ~2초.
- arena: contracts 제거 → 로컬 모델 + `gen:api` + contract-check. `next build` 통과, 4라우트 실렌더에 hub 데이터 확인.
- NestJS hub·contracts 삭제, compose 인프라 전용화.

## 함정 기록 (재발 방지)

- **Flyway 플레이스홀더 vs PG 달러 인용**: `$tag${...}`를 `${placeholder}`로 오인 → `spring.flyway.placeholder-replacement: false`.
- r2dbc-postgresql은 JSONB 코덱(`io.r2dbc.postgresql.codec.Json`)을 어댑터가 직접 쓰므로 runtimeOnly가 아니라 implementation.
