# 데이터 모델

> **스키마의 실물은 Flyway 마이그레이션** [`services/api/src/main/resources/db/migration/`](../../services/api/src/main/resources/db/migration/) (V1=최초 스키마, V2=수치화+채점 파이프라인, 시드는 `db/seed/R__dev_seed.sql`) — 이 문서는 관계·소유권·설계 의도를 설명한다. 스키마가 바뀌면 이 문서를 같은 흐름에서 갱신한다(하단 이력에 날짜·시각).

## 소유권 지도 ([ADR-0006](../decisions/0006-service-seams-and-ai-consolidation.md) — 스키마당 단일 작성자)

| 영역 | 주인(유일 작성자) | 상태 |
|---|---|---|
| 코어: problem·example·**test_case**·submission (+ 추후 user·ranking·contest) | **api** (R2DBC + Flyway) | **구현됨** |
| 테스트 번들(MinIO 오브젝트) | **api**가 발행 — DB `test_case`에서 **파생**된 캐시([ADR-0012](../decisions/0012-api-judge-wiring.md)) | **구현됨** |
| 임베딩: problem embedding (pgvector) | **plagiarism** | 예정 (M4) |
| 출제 파이프라인: 초안·검증 결과·검수 상태 | **problem** | 예정 (M3) |
| — judge는 어떤 스키마에도 쓰지 않는다(이벤트만) | — | 규칙 |

## 코어 ERD (현재 구현)

```
Problem 1 ──── * Example      (공개 예제, onDelete: Cascade)
   │      1 ──── * TestCase   (히든 테스트케이스 — 실채점용, Cascade)
   │
   1
   │
   * Submission               (제출 기록 + 채점 결과)
```

### Problem — 문제 (web mock을 drop-in 이관한 초기 형태)

| 필드 | 타입 | 비고 |
|---|---|---|
| id | Int (PK, 수동) | 백준식 문제 번호(1000~). autoincrement 아님 |
| title, description, inputDesc, outputDesc | String | 지문 |
| difficulty / tier | String | "Silver" / "Silver III" |
| time_limit_ms / memory_limit_mb | INT | 수치(2026-07-27 부채 상환 — 구 "1초"/"256 MB" 문자열). 표시 형식은 web이 만든다 |
| test_bundle_key / test_bundle_sha256 | TEXT? | claim-check 참조 — `test_case`에서 만든 MinIO 번들의 **캐시**(진실원 아님) |
| submission_count / accepted_count | INT | 정답률 계산은 web 도메인 함수(acceptanceRate) |
| tags | String[] | Postgres 배열 |
| aiGenerated | Boolean | AI 생성 표식 |
| starterCode | Json | 언어별 시작 코드 맵 |

### example — 공개 예제 입출력

`problem_id` FK + `ord`(표시 순서 — `order`는 SQL 예약어라 개명). 문제 삭제 시 연쇄 삭제(Cascade). **지문에 보여주는 용도**이며 채점에는 쓰지 않는다.

### test_case — 히든 테스트케이스 (실채점용)

`problem_id` FK + `ord` (`UNIQUE(problem_id, ord)`). **이 행들이 채점 데이터의 진실원**이고, api가 이것을 tar.gz로 묶어 MinIO에 올린 뒤 judge에는 참조(키+sha256)만 넘긴다(claim-check — [ADR-0009](../decisions/0009-judge-kickoff-async-and-contracts.md)·[0012](../decisions/0012-api-judge-wiring.md)). 패킹은 **결정적**이어야 한다(mtime·모드 고정) — 안 그러면 같은 케이스인데 해시가 매번 달라져 judge 캐시가 빗나간다.

### users — 사용자 (V5, [ADR-0019](../decisions/0019-authentication-kakao-oidc.md))

| 컬럼 | 비고 |
|---|---|
| provider + provider_id | **신원의 진실원** — `UNIQUE(provider, provider_id)`. provider='kakao'(OIDC `sub`) / 'seed'(개발 픽스처 전용 — 실 로그인 경로와 절대 안 겹침) |
| nickname | 로그인 시점 스냅샷(재로그인 시 갱신). 비밀번호 컬럼은 **존재하지 않는다**(OAuth 단독) |
| role | 'USER' \| 'ADMIN' — M3 검수 UI 대비 선반영 |

테이블명이 `user`가 아닌 이유: PG 예약어. V5는 기존 제출이 있으면(개발 DB) username별 시드 유저를 만들어 귀속한 뒤 `user_id NOT NULL`을 건다 — 빈 DB(운영)에는 더미 행을 만들지 않는다.

### submission — 제출

| 컬럼 | 비고 |
|---|---|
| **user_id** | BIGINT **NOT NULL** FK→users — 소유의 진실원. "제출은 로그인 필수"가 스키마 불변식으로(V5) |
| username | TEXT — 표시용 닉네임 스냅샷(제출 시점). ~~인증 도입 전 임시~~ → 역할 재정의(V5) |
| problem_id FK, **problem_title** | ⚠️ problem_title은 mock 이관에서 온 **비정규화 중복** — 정규화 refine 후보 |
| result | TEXT — "맞았습니다"/"채점 중" 등 한국어 라벨(api 도메인 JudgeResult enum의 label과 일치) |
| exec_time_ms / memory_used_kb | INT **NULL 허용** — 채점 전에는 값이 없다(구 TEXT 스키마는 '—' 문자열로 없음을 흉내냈다) |
| code | TEXT? — 제출 소스(재채점·표시용) |
| judged_at | TIMESTAMP? — 채점 완료 시각. NULL이면 채점 전 |
| language, length, submitted_at | 제출 메타 |

## 설계 의도와 부채 (정직 기록)

- **의도**: M1 슬라이스에서 web가 쓰던 mock 형태를 그대로 스키마로 옮겨 **프론트 무변경 교체(drop-in)** 를 우선했다. 정규화·수치화보다 세로 슬라이스 완주가 먼저.
- **상환 완료**: ~~`timeLimit`/`memoryLimit`/`exec_time`·`exec_memory` 문자열~~ → 수치(2026-07-27, V2). 이유는 표시 형식과 데이터를 분리(비교·계산 가능)하고 judge 계약(proto)이 수치라 경계마다 파싱하지 않기 위함.
- **V6 상환**(2026-07-31, [ADR-0020](../decisions/0020-data-debt-starter-templates.md)): `starter_template`(언어별 공용 템플릿, api 소유 — 유효 스타터 = problem 오버라이드 ?: 템플릿, 병합은 api) / `result` 저장값 enum name화(라벨은 응답 경계) / `problem_title` 컬럼 제거(제목 프로젝션 조인).
- **알려진 부채** (TODO Deferred 추적):
  ① ~~타임존~~ → **상환 완료**(2026-07-28, V4): 전부 `timestamptz`(UTC 절대시각), 도메인은 `Instant`, 지역 변환은 화면에서만([ADR-0015](../decisions/0015-cross-service-time-contract.md))
  ② ~~`submission.problem_title` 비정규화 제거~~ → **상환 완료**(2026-07-31, V6)
  ③ ~~`username` 문자열 → User 모델+FK~~ → **상환 완료**(2026-07-31, V5): `users` + `user_id NOT NULL`, username은 표시 스냅샷으로 역할 재정의([ADR-0019](../decisions/0019-authentication-kakao-oidc.md))
  ④ ~~`result` 한국어 리터럴~~ → **상환 완료**(2026-07-31, V6): enum name 저장
  ⑤ ~~케이스별 채점 결과 미저장~~ → **상환 완료**(2026-07-28, V3): `submission_case` 테이블([ADR-0014](../decisions/0014-execution-modes-and-case-feedback.md))
  ⑥ ~~스타터 코드가 문제×언어로 곱해진다~~ → **상환 완료**(2026-07-31, V6): `starter_template` + 오버라이드([ADR-0020](../decisions/0020-data-debt-starter-templates.md))

## 예정 스키마 (착수 시 이 문서에 추가)

- **plagiarism**: `problem_embeddings`(pgvector) — 문제 텍스트 임베딩, 유사도 검색 인덱스. 문제 원문은 api 이벤트/API로 수신(직접 조인 금지).
- **problem**: 파이프라인 상태머신(초안 문제·plagiarism 판정·교차검증 결과·검수 대기/승인) — 승인 시 api admin API로 공개 이관.
- **api 확장**: ~~User(인증)~~(V5 완료), Ranking(Redis sorted set과 역할 분담 정의 필요), Contest.

## 갱신 이력

- 2026-07-31 21:40 — **V6**(`starter_template`·result 코드화·problem_title 제거 — 부채 ②④⑥ 상환, [ADR-0020](../decisions/0020-data-debt-starter-templates.md)). 알려진 부채 전부 상환 완료.
- 2026-07-31 21:02 — **V5**(`users` + `submission.user_id NOT NULL` — 부채 ③ 상환, [ADR-0019](../decisions/0019-authentication-kakao-oidc.md)). 기존 개발 DB(guest 포함 픽스처)에 조건부 시드 유저 귀속이 실측대로 동작.

- 2026-07-28 21:35 — **V3**(실행 모드 `submission.mode`·예제 번들 참조·`submission_case` 케이스별 결과) + **V4**(시각 전부 `timestamptz` UTC — 부채 ① 상환). 부채 목록에서 타임존·케이스별 결과 항목 제거.
- 2026-07-27 23:13 — **V2 마이그레이션**: 제한·측정값 수치화(`time_limit_ms`·`memory_limit_mb`·`exec_time_ms`·`memory_used_kb`), `test_case` 테이블 신설(히든 케이스 진실원), `problem.test_bundle_*`(claim-check 참조 캐시), `submission.code`·`judged_at` 추가. 부채 목록 갱신(타임존·케이스별 결과 추가).
- 2026-07-25 14:07 — api Kotlin 전환([ADR-0007](../decisions/0007-backend-kotlin-return.md)) 반영: 스키마 실물 Prisma → **Flyway V1/V2**(snake_case, 예약어 회피: `username`·`ord`·`exec_time`), 소유권 표기 R2DBC+Flyway.
- 2026-07-25 12:48 — 문서 신설. 현행 3모델(problem/example/submission) + 소유권 지도 + 부채 기록.
