# 아키텍처 결정 기록 (ADR)

확정된 주요 결정을 1건당 1문서로 남긴다. "왜 이렇게 정했는지"를 미래의 나(그리고 포트폴리오를 보는 사람)에게 설명하는 기록이다.

## 작성 규칙

- 파일명: `NNNN-제목.md` (4자리 일련번호).
- 상태(Status): `Proposed`(논의 중) → `Accepted`(확정) → `Superseded by NNNN`(다른 결정으로 대체) / `Deprecated`.
- **결정이 바뀌면 기존 ADR은 원문 동결**(상태 줄만 `Superseded by NNNN`으로 갱신)하고 **새 ADR을 발행**한다. 본문 재작성·삭제 금지 — 히스토리는 각 ADR 원문이 보존한다. (2026-07-25 확정, [0008](0008-service-naming-and-group.md) 참조)
- 확정된 결정은 이 문서(ADR)에 정식 기록하고, [/CLAUDE.md](../../CLAUDE.md) '확정 사항'에는 결론만 요약한다.
- 템플릿: [template.md](template.md).

## 목록

| # | 제목 | 상태 |
|---|---|---|
| [0001](0001-tech-stack.md) | 기술 스택 선정 | Accepted (Backend 항목 0005로 대체) |
| [0002](0002-poc-scope-and-design.md) | POC 범위 및 디자인 방향 | Accepted |
| [0003](0003-monorepo-structure.md) | 모노레포 폴더 구조 | Superseded by 0008 (그룹명·네이밍) |
| [0004](0004-frontend-architecture.md) | 프론트엔드 코드 아키텍처 | Accepted |
| [0005](0005-backend-language-and-type-sharing.md) | 백엔드 언어 재선정 + 프론트·백 타입 공유(짝 A) | Superseded by 0007 |
| [0006](0006-service-seams-and-ai-consolidation.md) | 서비스 이음새 규칙 + AI 서비스 병합(3→2) | Accepted |
| [0007](0007-backend-kotlin-return.md) | 백엔드 Kotlin+Spring 복귀 — 모던 스택 제약 + OpenAPI 계약 | Accepted |
| [0008](0008-service-naming-and-group.md) | 서비스 네이밍·그룹 개편 — `services/` + 2층 체계 | Accepted (루트 구성 항목 0010으로 개정) |
| [0009](0009-judge-kickoff-async-and-contracts.md) | Judge 착수 설계 — Kafka 직행(M1/M2 통합) + claim-check + Protobuf | Accepted |
| [0010](0010-contracts-root-group.md) | 루트 `contracts/` 신설 — 언어 중립 IDL 거처 (0008 개정) | Accepted |
| [0011](0011-codegen-and-kafka-client.md) | 코드젠(buf, BSR 미사용)·Kafka 클라이언트(franz-go)·전달 보장(at-least-once) | Accepted |
| [0012](0012-api-judge-wiring.md) | api↔judge 배선 — JVM 코드젠·Kafka 클라이언트 직접 사용·SSE 인프로세스·테스트케이스 진실원 | Accepted |
| [0013](0013-judge-language-expansion.md) | judge 언어 확장 — 지원 범위(3종)·공용 Go 하니스·언어별 자원 정책 | Accepted |
| [0014](0014-execution-modes-and-case-feedback.md) | 실행 모드 분리(run/submit)와 케이스별 채점 피드백 | Accepted |
| [0015](0015-cross-service-time-contract.md) | 서비스 경계의 시간 규약 — UTC 절대시각 통일 | Accepted |
| [0016](0016-test-strategy.md) | 테스트 전략 — 선별적 TDD·커버리지 비목표·금지 규칙 | Accepted |
| [0017](0017-published-language.md) | `contracts/`를 서비스 간 공표 언어로 격상 — 공통 타입(trace·error) | Accepted |
