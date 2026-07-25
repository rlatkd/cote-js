# 용어집 (Glossary)

프로젝트에서 반복되는 도메인·기술 용어를 고정한다. 새 용어가 반복되면 여기에 추가.

## 도메인

- **문제 (Problem)**: 알고리즘 코딩 테스트 문항. 지문·입출력·제약·예제·테스트케이스로 구성.
- **생성 문제 (Generated Problem)**: AI가 새로 만든 문제.
- **유사도 검증 (Similarity Validation)**: 생성 문제가 기존 문제와 지나치게 유사한지 임베딩 벡터로 판정. 기준 초과 시 폐기.
- **문제 검증 (Problem Validation)**: 생성 문제가 실제로 풀 수 있고 정답·테스트케이스가 올바른지 검증.
- **정답 교차검증**: 서로 다른 세션/모델로 생성한 N개 풀이의 출력이 모두 일치할 때만 기대 정답으로 채택. LLM의 동일 오해로 인한 오검증 방지.
- **사람 검수 게이트 (Human Review Gate)**: 자동 검증을 통과한 문제도 사람이 승인해야 사용자에게 공개.
- **제출 (Submission)**: 사용자가 낸 코드 1건.
- **채점 (Judge)**: 제출 코드를 격리 환경에서 실행해 정답/오답/시간초과 등으로 판정.

## 기술

- **RSC (React Server Components)**: 서버에서 렌더되는 React 컴포넌트. 데이터 패칭을 서버에서 처리.
- **client island**: 서버 렌더 페이지 안에서 상호작용을 담당하는 `"use client"` 컴포넌트 영역.
- **Server Actions**: Next.js에서 서버 함수로 뮤테이션을 처리하는 방식.
- **pgvector**: PostgreSQL의 벡터 검색 확장. 임베딩 저장·유사도 검색을 RDB 안에서 처리.
- **임베딩 (Embedding)**: 텍스트를 벡터로 변환한 표현. 유사도 계산에 사용.
- **ADR (Architecture Decision Record)**: 아키텍처 결정 1건당 1문서로 남기는 기록.
- **샌드박스 (Sandbox)**: 신뢰할 수 없는 코드를 격리 실행하는 환경.
- **자체 채점 엔진 (from-scratch judge)**: 오픈소스(Judge0 등)를 쓰지 않고 직접 구현한 채점 엔진.
- **contracts (`@cotejs/contracts`)** *(폐기 — [ADR-0007](decisions/0007-backend-kotlin-return.md))*: 프론트·백이 함께 import하던 공유 타입 패키지. 도메인 타입 + zod 스키마의 단일 진실원이었다. 백엔드의 Kotlin 전환으로 폐기 → OpenAPI codegen 계약으로 대체.
- **짝 A (pairing A)** *(폐기 — [ADR-0007](decisions/0007-backend-kotlin-return.md))*: 프론트·백엔드를 같은 TS로 두고 `contracts`로 타입을 공유하는 전략([ADR-0005](decisions/0005-backend-language-and-type-sharing.md)). 폴리글랏 경계는 IDL로 계약한다는 부분은 존치.
- **OpenAPI codegen 계약**: api(springdoc)가 생성한 `/v3/api-docs` 스펙을 web이 `pnpm gen:api`로 타입 생성(`schema.d.ts`) + `contract-check.ts`가 컴파일 타임에 도메인 모델과 대조. 계약이 어긋나면 `next build` 실패.
- **IDL (Interface Definition Language)**: 언어 중립 계약 정의(Protobuf/Avro·OpenAPI). 서로 다른 언어 서비스 간 메시지·API 계약에 사용.

## 서비스 네이밍 — 2층 체계 ([ADR-0008](decisions/0008-service-naming-and-group.md))

**상위 = 책임 영역**(무엇을 담당), **하위 = 처리 단계**(어떤 순서로). 그룹 폴더는 `services/`.

- **web** *(구 arena)*: 프론트엔드(Next.js + TS) — 사용자 화면.
- **api** *(구 hub)*: 백엔드(Kotlin + Spring, [ADR-0007](decisions/0007-backend-kotlin-return.md)) — 비즈니스 로직·데이터·오케스트레이션. 문제 **서빙** 담당(제작은 problem).
- **judge**: 코드 채점(Go) — executor → sandbox → verdict (+consumer, M2). online judge는 업계 표준어라 유지.
- **problem** *(구 setter)*: 문제 **제작 공정**(Python) — generation → validation → workflow. validation이 구 tester([ADR-0006](decisions/0006-service-seams-and-ai-consolidation.md) 병합) 단계.
- **plagiarism** *(구 scout)*: 표절 탐지(Python) — embedding → retrieval → scoring. 임베딩 모델 상주라 독립 서비스.

> 구명(arena·hub·setter·scout·tester)은 2026-07-25 이전 문서·커밋에 등장한다 — 경위는 [ADR-0008](decisions/0008-service-naming-and-group.md), 원문은 [ADR-0003](decisions/0003-monorepo-structure.md)(동결).
