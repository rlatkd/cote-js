# 0005. 백엔드 API 언어·프레임워크 재선정 + 프론트·백 타입 공유(짝 A)

- **상태**: **Superseded by [0007](0007-backend-kotlin-return.md)** (2026-07-25 — Kotlin+Spring 복귀. 본 ADR의 전제 "Kotlin=실무 재탕"은 모던 스택 강제(코루틴·WebFlux·R2DBC·Hexagonal) 조건에서 반박됨. 짝 A 타입 공유는 OpenAPI codegen+컴파일타임 계약 체크로 대체)
- **일자**: 2026-07-11
- **관련**: [0001](0001-tech-stack.md) 백엔드 항목을 대체(부분 supersede), [0003](0003-monorepo-structure.md) 모노레포 구조와 연동, [0004](0004-frontend-architecture.md) 프론트 아키텍처와 정합

## 맥락

[ADR-0001]은 Backend API를 **Kotlin + Spring Boot**로 잠정 확정했다. 착수 시점에 재검토하며 두 가지가 걸렸다.

1. **사용자 실무가 Java + Spring Boot**다. Kotlin+Spring은 언어만 다르고 패러다임·생태계가 실무와 동일 → **학습 신규성·포트폴리오 차별화가 가장 낮은** 선택. 프로젝트 목표(넓은 신규 스택 학습)와 충돌.
2. 작업 환경이 **VSCode**인데, Kotlin의 VSCode 지원은 2025년 JetBrains 공식 LSP가 나왔으나 아직 초기(JVM-only Gradle, 부분 클로즈드소스)로 TS/Go/Rust의 성숙한 툴링에 못 미침.

또한 모노레포에는 이미 **TS(arena) · Python(AI) · Go(judge)** 가 있어, 백엔드를 어느 이웃과 "같은 언어로 묶느냐"가 실질 결정 축이었다.

## 결정

- **Backend API = TypeScript + NestJS + Prisma (PostgreSQL).** Kotlin+Spring 배제.
- **짝 A 채택**: 백엔드를 프론트(arena)와 같은 TS로 두고, **프론트·백이 공유 타입 패키지(`@cotejs/contracts`)를 함께 import**한다. 계약(도메인 타입 + zod 스키마)을 단일 진실원으로 두어, 한쪽을 바꾸면 반대쪽이 컴파일 단계에서 맞물린다.
- **ORM = Prisma** (TypeORM 배제). 타입세이프·최신 DX가 짝 A의 타입 안정성 테마와 일관.
- 폴리글랏 경계(백↔judge=TS↔Go, 백↔AI=TS↔Python)는 같은 언어로 못 묶으므로 **추후 IDL(Protobuf/Avro, OpenAPI)로 계약**한다. 즉 `contracts`는 TS 짝 전용, IDL은 폴리글랏 경계 전용.

## 근거

| 기준 | Kotlin+Spring(기존) | **NestJS(채택)** |
|---|---|---|
| 포트폴리오 | 높지만 day job과 동일 계열 → 차별화 약함 | 좋음 + **풀스택 TS·end-to-end 타입 공유** 서사 |
| 학습 신규성 | 낮음(실무와 동일) | 중(TS는 익숙하나 Nest는 새 패러다임, Spring 지식 전이) |
| 문제 적합성 | 최상(무거운 도메인·트랜잭션) | 좋음(CRUD·인증·Kafka 프로듀서에 충분, Prisma) |
| VSCode DX | 약함(IntelliJ 정석) | **최상(네이티브 TS)** |
| 모노레포 | JVM 유일(다양성 최대) | TS 중복이나 프론트와 **타입 공유 이득** |

- Nest의 DI·모듈·데코레이터는 Spring과 개념이 닮아 실무 지식이 전이되면서도 런타임/생태계는 완전히 새것.
- "제품 표면(프론트+백)"을 한 언어·한 워크스페이스로 묶으면 계약 공유가 공짜. 코딩테스트는 제품이라 이 경계가 가장 자주 바뀌므로 이득이 매일 발생.

## 검토한 대안

- **Go(백+judge 묶기, 짝 B)**: 시스템 언어 깊이·Kafka 자연스러움은 매력이나, 무거운 비즈니스 도메인엔 적합성이 약하고 Go가 2개가 되어 언어 다양성 손해. 프론트-백 타입 공유도 못 얻음. → 미채택.
- **NestJS 외 TS 프레임워크**: AdonisJS(신규성 최대), Fastify+자체 레이어드(프론트 철학과 일관), Hono/Elysia(경량) 검토. Spring 지식 전이 + 성숙도로 **NestJS** 선택.
- **.NET / Rust**: 새 생태계로 다양성·포트폴리오는 좋으나 Rust는 CRUD API에 오버엔지니어링, .NET은 국내 트렌드 약함. → 미채택.
- **TypeORM**: JPA식 리포지토리로 실무 전이가 크지만, 타입 안정성·DX에서 Prisma 우위 → 미채택.

## 결과

- 폴더: `platform/hub`(NestJS). 프론트 `platform/arena`, 공유 `platform/contracts`. 상세 구조는 [0003] 갱신.
- `@cotejs/contracts`가 `Problem·Submission` 타입 + zod 스키마 + 순수 도메인 함수(`acceptanceRate` 등)를 소유. arena의 `entities/*/model.ts`는 여기서 재수출만.
- hub는 GET `/api/problems`·`/api/problems/:id`·`/api/submissions`, POST `/api/submissions`(zod 검증) 제공. arena의 Repository(`entities/*/api.ts`)가 mock → hub fetch로 교체됨(views·viewmodel 무변경).
- 실제 채점은 여전히 **Judge(Go) 마일스톤**의 몫. hub는 제출을 영속화하고 "채점 중"으로 반환(POC stub).
- 아키텍처 상세: [architecture/api.md](../architecture/api.md).
