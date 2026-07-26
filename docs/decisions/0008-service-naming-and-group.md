# 0008. 서비스 네이밍·그룹 개편 — `services/` + 2층 체계(책임 영역/처리 단계)

- **상태**: Accepted (루트 구성(3개념) 항목은 [0010](0010-contracts-root-group.md)으로 개정 — `contracts/` 추가로 4개념)
- **일자**: 2026-07-25
- **대체**: [0003](0003-monorepo-structure.md)의 그룹명·서비스 네이밍 결정 (원문 동결)

## 맥락

[0003]의 네이밍(arena·hub·judge·setter·scout — CP 도메인 은유)을 재검토하다 사용자가 두 결함을 짚었다:

1. **arena·hub는 결국 frontend/backend의 은유 포장** — judge·setter처럼 "하는 일"을 말하는 게 아니라 아키텍처상 위치를 꾸민 것(정보량 0).
2. 기능명(-er)으로 통일하려 하자 **상위 이름이 하위 일부만 대표하는 결함이 연쇄** — generator↛validation, embedding↛search, author↛pipeline. "상위=행위자" 체계의 구조적 한계.

## 결정

### 1. 그룹 폴더 = `services/` (구 `platform/`)

- 루트 = **`services / infra / docs`** — 세 폴더가 전부 "내용물 직설"로 평행.
- `platform`은 "이것들이 모여 이루는 제품"의 이름이지 "폴더에 든 것"의 이름이 아님 — 내용물은 서비스들이므로 `services`. 폴리글랏 모노레포의 관용이기도 함.
- `services/`는 순수 그룹 폴더(도구 설정 없음), **각 서비스가 자기 빌드 도구를 자기 안에 소유**(web=pnpm, api=Gradle, judge=Go mod, problem/plagiarism=Python) — [0003]의 이 원칙은 승계.

### 2. 네이밍 = 2층 체계 — **상위 = 책임 영역, 하위 = 처리 단계** (사용자 제안)

상위는 "무엇을 담당하나", 하위는 "어떤 단계를 거치나"에 답한다. 은유도, 행위자 통일도 아닌 **책임 영역 명사**.

```
services/
├─ web/           프론트엔드 — Next.js + TS
├─ api/           백엔드 — Kotlin + Spring ([0007])
├─ judge/         코드 채점 — Go        · executor → sandbox → verdict (+consumer, M2)
├─ problem/       문제 제작 공정 — Python · generation → validation → workflow
└─ plagiarism/    표절 탐지 — Python    · embedding → retrieval → scoring
```

| 구명 | 신명 | 근거 |
|---|---|---|
| arena | **web** | 범용 표면은 평이한 기능명이 정직(은유는 코스프레) |
| hub | **api** | 〃. Kotlin 패키지도 `com.cotejs.api` |
| judge | **judge (유지)** | -er 체계에선 이질적이었으나 책임 영역 체계에선 정합 + online judge는 업계 표준어(정보량 최대) |
| setter | **problem** | 상위=영역(문제 제작 공정), 하위가 단계(generation·validation·workflow)로 전부 포괄됨 |
| scout | **plagiarism** | 수단(embedding)·행위(matching)가 아닌 **존재 이유**(표절 탐지). plagiarism detection은 실존 용어(MOSS 등). 하위 embedding→retrieval→scoring은 교과서적 IR 3단계 |
| (tester) | problem의 `validation` 단계 | [0006] 병합 유지 |

파이프라인 읽기: "**problem이 만들고 → plagiarism이 거르고 → judge가 채점한다.**"

- `problem`과 api의 "문제 서빙"의 구분: **api = 문제 제공(서빙), problem = 문제 제작(공정)**.

## 검토한 대안 (경위 — 이 결정에 이른 순서)

1. **CP 은유 유지**(arena/hub…): 전문 서비스(judge/setter)엔 유효했으나 범용 표면에선 실패 → 폐기.
2. **행위자(-er) 통일**: web/api/grader/generator/matcher → author/matcher… — 상위가 하위를 못 덮는 결함 연쇄(맥락 참조)로 폐기. 후보였던 grader(autograder)·matcher·author는 기록으로 남김.
3. **evaluator**(채점): `eval()`/수식 평가기 연상으로 기각. **producer**(출제): Kafka producer와 충돌로 기각.
4. **2층 체계(채택)**: 상위·하위의 질문이 달라("무엇을/어떻게") 포괄 문제가 구조적으로 없음.

## 결과 (2026-07-25 실행·검증 완료)

- `git mv`: `platform→services`, `arena→web`, `hub→api`. judge/problem/plagiarism 폴더는 각 마일스톤 착수 시 생성.
- api: Kotlin 패키지 `com.cotejs.hub→com.cotejs.api`, `HubApplication→ApiApplication`, `rootProject.name=api`. 컴파일·기동·curl 전 항목 그린.
- web: 패키지명 `@cotejs/web`, fetch 헬퍼 `shared/api/hub.ts→client.ts`(`apiGet`/`apiGetOptional`, env `HUB_URL→API_URL`). `next build` 그린.
- **함정 기록**: 일괄 개명 중 Flyway V1/V2 SQL 주석까지 바꿔 **체크섬 불일치로 기동 실패** → 원복. **적용된 마이그레이션 파일은 불변**(주석의 구명 잔존은 의도된 것).

## ADR 운영 규칙 (이 건으로 확정)

**결정이 바뀌면 기존 ADR은 원문 동결(상태만 `Superseded by NNNN`)하고 새 ADR을 발행한다.** 문서 내 재작성 누적 금지 — 히스토리는 각 ADR 원문이 보존한다.
