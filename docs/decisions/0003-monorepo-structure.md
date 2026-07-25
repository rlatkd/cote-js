# 0003. 모노레포 폴더 구조

- **상태**: Accepted (2026-07-25 갱신 — AI 서비스 3→2 병합, [0006](0006-service-seams-and-ai-consolidation.md))
- **일자**: 2026-07-09 (개정 2026-07-11, 2026-07-25)

## 맥락

프론트엔드·백엔드·AI·Judge 등 여러 폴리글랏 서비스를 한 저장소에 둔다. 최상위 폴더를 어떻게 나눌지, 그리고 [0005](0005-backend-language-and-type-sharing.md)에서 도입한 **프론트·백 공유 타입 패키지**를 어디에 둘지 결정 필요.

## 결정

### 1. TS 제품 표면은 `platform/` 그룹 하위에 묶는다

폴리글랏 루트를 통째로 JS 워크스페이스로 만들지 않는다. 대신 **루트 밑에 `platform/` 계층을 하나 두고**, 그 안에서만 pnpm 워크스페이스를 돌린다. Go(judge)·Python(AI)은 `platform/` 밖 **루트 직속 형제**로 두어 JS 워크스페이스와 완전히 분리한다.

```
cotejs/                     폴리글랏 루트 (JS 워크스페이스 아님, git 루트)
├─ platform/                TS/JS 워크스페이스 루트 (pnpm-workspace.yaml 여기)
│  ├─ arena/                Next.js — 참가자가 문제를 풀고 제출하는 경기장 (구 frontend)
│  ├─ hub/                  NestJS — 유저·문제·제출·랭킹을 잇는 중심 (구 backend/api)
│  └─ contracts/            @cotejs/contracts — arena·hub 공유 타입+zod (짝 A의 실체)
├─ infra/                   docker-compose (postgres → 추후 redis·kafka)
├─ docs/
└─ (추후 마일스톤, 루트 직속)
   ├─ judge/                Go — 제출 채점
   ├─ setter/               Python — 문제 출제(생성 + 품질 검증 + 파이프라인 지휘, [0006])
   └─ scout/                Python — 기존 문제와 중복 정찰(유사도, 임베딩 서빙)
```

### 2. 서비스명은 역할이 드러나는 도메인 용어로

`frontend`/`backend` 같은 계층명 대신, **경쟁 프로그래밍 도메인의 실제 역할 용어**를 쓴다. `judge`가 "채점"을 드러내듯 각 서비스가 하는 일이 이름에 박히게 한다.

| 폴더 | 역할 | 스택 |
|---|---|---|
| `arena` | 참가자가 문제를 풀고 제출하는 경기장 | Next.js |
| `hub` | 유저·문제·제출·랭킹을 잇고 judge로 디스패치하는 중심 | NestJS |
| `contracts` | arena·hub가 지키는 API 계약(타입) | TS + zod |
| `judge` | 제출을 채점 (실제 CP 용어) | Go |
| `setter` | 문제 출제 = "problem setter" (실제 CP 용어). 생성 + 품질 검증(내부 `tester` 모듈) + 파이프라인 지휘 | Python |
| `scout` | 기존 문제와 겹치는지 정찰 | Python |

파이프라인이 폴더명으로 읽힌다: **setter가 내고 검증하고 → scout이 거르고 → judge가 채점한다.**

> **개정(2026-07-25)**: 당초 `tester`를 독립 서비스로 뒀으나, 생성·검증은 항상 붙어 도는 한 파이프라인이고 둘 다 경량 I/O 오케스트레이션이라 분리 실익이 없어 **setter의 내부 모듈로 병합**했다(scout만 임베딩 서빙이라 자원 특성이 달라 독립 유지). 상세 근거: [ADR-0006](0006-service-seams-and-ai-consolidation.md). 실제 CP에서도 setter가 출제와 테스트 준비·검증을 함께 담당하므로 명칭 정합.

## 근거

- **`platform/` 그룹**: pnpm을 폴리글랏 루트에 얹으면 Go/Python과 개념이 뒤섞인다. 계층을 하나 둬서 JS 워크스페이스를 격리 → 루트는 순수 서비스 분해를 유지. `platform`은 [0005]에서 정의한 "제품 표면(프론트+백)" 개념과도 정합.
- **`contracts` 위치**: [0003 원안]이 배제한 것은 Turborepo의 `apps/packages`를 **전체 레포 컨벤션**으로 쓰는 것(폴리글랏에 반만 맞음)이었다. 여기서는 **TS 서비스끼리만 쓰는 공유 라이브러리**이므로 `platform/` 안에 두는 것이 자연스럽고 그 배제와 모순되지 않는다.
- **역할 네이밍**: 서비스 분해·도메인 이해도가 폴더만 봐도 드러나 포트폴리오 자산. 실제 CP 용어(setter/tester/judge)라 억지 작명이 아님.

## 검토한 대안

- **루트 = JS 워크스페이스**(초기 제안): 폴리글랏 루트가 JS 도구에 종속 → 반려. `platform/` 계층으로 격리.
- **`packages/contracts` 2단 중첩**: Turborepo 컨벤션 연상 + 불필요한 깊이 → 단일 `contracts/`로.
- **그룹명 `web`/`apps`/`ts`**: `platform`이 "제품 표면" 개념과 가장 맞아 채택.
- **폴더명 `frontend`/`backend`/`api`**: 계층명이라 역할이 안 드러남 → 도메인 역할명으로 전환.

## 결과

- `frontend/` → `platform/arena/` 이동 완료. `platform/hub`(NestJS)·`platform/contracts` 신설.
- 폴리글랏 경계 계약(hub↔judge, hub↔AI)은 같은 언어로 못 묶으므로 추후 **IDL(Protobuf/Avro·OpenAPI)** 로 처리 — `contracts`는 TS 짝 전용.
- AI 서비스 구성: ~~3분할(setter/scout/tester)~~ → **2분할(setter/scout)** 로 개정([ADR-0006](0006-service-seams-and-ai-consolidation.md)). judge/AI 폴더는 각 마일스톤 착수 시 생성.
