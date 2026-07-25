# 0003. 모노레포 폴더 구조

- **상태**: Accepted (2026-07-25 2차 개정 — **platform/ = 전 서비스 그룹**으로 재정의, [0007](0007-backend-kotlin-return.md)과 연동. 같은 날 1차: AI 3→2 병합 [0006](0006-service-seams-and-ai-consolidation.md))
- **일자**: 2026-07-09 (개정 2026-07-11, 2026-07-25 ×2)

## 맥락

프론트엔드·백엔드·AI·Judge 등 여러 폴리글랏 서비스를 한 저장소에 둔다. 최상위 폴더를 어떻게 나눌지, 그리고 [0005](0005-backend-language-and-type-sharing.md)에서 도입한 **프론트·백 공유 타입 패키지**를 어디에 둘지 결정 필요.

## 결정

### 1. `platform/` = **제품 서비스 전체의 그룹** (2026-07-25 재정의)

> **개정 경위**: 당초 `platform/`은 "TS 워크스페이스 그룹"(arena·hub·contracts가 타입을 공유)이었다. [0007]로 hub가 Kotlin이 되고 contracts가 폐기되며 그 전제가 소멸 → 사용자 제안으로 **"코딩테스트 플랫폼을 구성하는 서비스 전체의 그룹"으로 재정의**. 루트는 `platform / infra / docs` 3개념으로 정리되고, 서비스가 늘어도(judge·setter·scout) 루트가 어수선해지지 않는다.

- **`platform/`은 순수 그룹 폴더** — 자체 도구 설정을 갖지 않는다. **각 서비스가 자기 빌드 도구를 자기 안에 소유**한다(arena=pnpm, hub=Gradle, 추후 judge=Go mod, setter/scout=uv/poetry). 언어별 그룹핑이 아니므로 폴리글랏 중립.

```
cotejs/                     git 루트
├─ platform/                제품 서비스 전체 (폴더 = 서비스, 각자 도구 소유)
│  ├─ arena/                Next.js + TS — 경기장(프론트). pnpm 단독 패키지
│  ├─ hub/                  Kotlin + Spring Boot — 중심 API. Gradle ([0007])
│  └─ (추후 마일스톤)
│     ├─ judge/             Go — 제출 채점
│     ├─ setter/            Python — 문제 출제(생성+품질 검증+파이프라인 지휘, [0006])
│     └─ scout/             Python — 중복 정찰(유사도, 임베딩 서빙)
├─ infra/                   docker-compose — 인프라만(postgres → 추후 redis·kafka)
├─ docs/
└─ CLAUDE.md · README.md · RUN.md
```

### 2. 서비스명은 역할이 드러나는 도메인 용어로

`frontend`/`backend` 같은 계층명 대신, **경쟁 프로그래밍 도메인의 실제 역할 용어**를 쓴다. `judge`가 "채점"을 드러내듯 각 서비스가 하는 일이 이름에 박히게 한다.

| 폴더 | 역할 | 스택 |
|---|---|---|
| `arena` | 참가자가 문제를 풀고 제출하는 경기장 | Next.js |
| `hub` | 유저·문제·제출·랭킹을 잇고 judge로 디스패치하는 중심 | Kotlin + Spring ([0007]) |
| ~~`contracts`~~ | ~~arena·hub 공유 타입~~ → [0007]로 폐기, OpenAPI codegen으로 대체 | — |
| `judge` | 제출을 채점 (실제 CP 용어) | Go |
| `setter` | 문제 출제 = "problem setter" (실제 CP 용어). 생성 + 품질 검증(내부 `tester` 모듈) + 파이프라인 지휘 | Python |
| `scout` | 기존 문제와 겹치는지 정찰 | Python |

파이프라인이 폴더명으로 읽힌다: **setter가 내고 검증하고 → scout이 거르고 → judge가 채점한다.**

> **개정(2026-07-25)**: 당초 `tester`를 독립 서비스로 뒀으나, 생성·검증은 항상 붙어 도는 한 파이프라인이고 둘 다 경량 I/O 오케스트레이션이라 분리 실익이 없어 **setter의 내부 모듈로 병합**했다(scout만 임베딩 서빙이라 자원 특성이 달라 독립 유지). 상세 근거: [ADR-0006](0006-service-seams-and-ai-consolidation.md). 실제 CP에서도 setter가 출제와 테스트 준비·검증을 함께 담당하므로 명칭 정합.

## 근거

- **`platform/` 그룹(재정의 후)**: 루트가 `platform`(서비스) / `infra` / `docs` 3개념으로 정리되고 서비스 증가에 안정적. 그룹 폴더가 도구 중립이라 폴리글랏과 충돌 없음. "코딩테스트 **플랫폼**을 구성하는 서비스들"이라는 도메인 의미와도 정합.
- ~~(구) TS 워크스페이스 격리 근거~~: hub의 Kotlin 전환([0007])으로 전제 소멸 — 재정의로 대체.
- **역할 네이밍**: 서비스 분해·도메인 이해도가 폴더만 봐도 드러나 포트폴리오 자산. 실제 CP 용어(setter/tester/judge)라 억지 작명이 아님.

## 검토한 대안

- **루트 = JS 워크스페이스**(초기 제안): 폴리글랏 루트가 JS 도구에 종속 → 반려. `platform/` 계층으로 격리.
- **`packages/contracts` 2단 중첩**: Turborepo 컨벤션 연상 + 불필요한 깊이 → 단일 `contracts/`로.
- **그룹명 `web`/`apps`/`ts`**: `platform`이 "제품 표면" 개념과 가장 맞아 채택.
- **폴더명 `frontend`/`backend`/`api`**: 계층명이라 역할이 안 드러남 → 도메인 역할명으로 전환.

## 결과

- (2026-07-11) `frontend/` → `platform/arena/` 이동, `platform/hub`(NestJS)·`platform/contracts` 신설.
- (2026-07-25) hub를 Kotlin으로 재구현하며 `platform/hub`로 재배치, `contracts` 폐기([0007]). platform 그룹용 pnpm 파일 제거 — arena가 단독 패키지로 자기 설정 소유. 앱 Dockerfile 제거, compose는 인프라 전용(개발용 세팅).
- 폴리글랏 경계 계약: arena↔hub는 **OpenAPI codegen + 컴파일타임 계약 체크**([0007]), hub↔judge/AI는 추후 IDL(Kafka 스키마 포함).
- AI 서비스 구성: ~~3분할(setter/scout/tester)~~ → **2분할(setter/scout)** 로 개정([ADR-0006](0006-service-seams-and-ai-consolidation.md)). judge/AI 폴더는 각 마일스톤 착수 시 생성.
