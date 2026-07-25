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
- **contracts (`@cotejs/contracts`)**: arena·hub가 함께 import하는 공유 타입 패키지. 도메인 타입 + zod 스키마의 단일 진실원.
- **짝 A (pairing A)**: 프론트(arena)·백엔드(hub)를 같은 TS로 두고 `contracts`로 타입을 공유하는 전략. 폴리글랏 경계(hub↔judge 등)는 IDL로 계약. ([ADR-0005](decisions/0005-backend-language-and-type-sharing.md))
- **IDL (Interface Definition Language)**: 언어 중립 계약 정의(Protobuf/Avro·OpenAPI). 서로 다른 언어 서비스 간 메시지·API 계약에 사용.

## 서비스 네이밍

폴더명이 곧 역할이다(경쟁 프로그래밍 도메인 용어). 상세: [ADR-0003](decisions/0003-monorepo-structure.md).

- **arena**: 참가자가 문제를 풀고 제출하는 경기장 = 프론트엔드(Next.js).
- **hub**: 유저·문제·제출·랭킹을 잇는 중심 = 백엔드 API(NestJS).
- **judge**: 제출을 채점 = 채점 엔진(Go).
- **setter**: 문제를 출제("problem setter") = AI 생성 + 품질 검증 + 파이프라인 지휘(Python). 실제 CP처럼 출제자가 문제와 테스트 검증을 함께 담당.
- **scout**: 기존 문제와 중복을 정찰 = 유사도 검증(Python, 임베딩 서빙이라 독립 서비스).
- **tester**: ~~독립 서비스~~ → setter 내부의 **검증 모듈** 이름으로 강등([ADR-0006](decisions/0006-service-seams-and-ai-consolidation.md)). 출제 전 정답 교차검증·TC 변별력 확인 단계.
