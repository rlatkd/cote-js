# 데이터 모델

> **스키마의 실물은 Flyway 마이그레이션** [`platform/hub/src/main/resources/db/migration/`](../../platform/hub/src/main/resources/db/migration/) (V1=스키마, V2=시드) — 이 문서는 관계·소유권·설계 의도를 설명한다. 스키마가 바뀌면 이 문서를 같은 흐름에서 갱신한다(하단 이력에 날짜·시각).

## 소유권 지도 ([ADR-0006](../decisions/0006-service-seams-and-ai-consolidation.md) — 스키마당 단일 작성자)

| 영역 | 주인(유일 작성자) | 상태 |
|---|---|---|
| 코어: problem·example·submission (+ 추후 user·ranking·contest) | **hub** (R2DBC + Flyway) | **구현됨** |
| 임베딩: problem embedding (pgvector) | **scout** | 예정 (M4) |
| 출제 파이프라인: 초안·검증 결과·검수 상태 | **setter** | 예정 (M3) |
| — judge는 어떤 스키마에도 쓰지 않는다(이벤트만) | — | 규칙 |

## 코어 ERD (현재 구현)

```
Problem 1 ──── * Example      (지문 예제, onDelete: Cascade)
   │
   1
   │
   * Submission               (제출 기록)
```

### Problem — 문제 (arena mock을 drop-in 이관한 초기 형태)

| 필드 | 타입 | 비고 |
|---|---|---|
| id | Int (PK, 수동) | 백준식 문제 번호(1000~). autoincrement 아님 |
| title, description, inputDesc, outputDesc | String | 지문 |
| difficulty / tier | String | "Silver" / "Silver III" |
| timeLimit / memoryLimit | String | ⚠️ "1초"/"256 MB" 문자열 — 수치화(ms·MB) refine 예정 |
| submission_count / accepted_count | INT | 정답률 계산은 arena 도메인 함수(acceptanceRate) |
| tags | String[] | Postgres 배열 |
| aiGenerated | Boolean | AI 생성 표식 |
| starterCode | Json | 언어별 시작 코드 맵 |

### example — 예제 입출력

`problem_id` FK + `ord`(표시 순서 — `order`는 SQL 예약어라 개명). 문제 삭제 시 연쇄 삭제(Cascade).

### submission — 제출

| 컬럼 | 비고 |
|---|---|
| username | TEXT — ⚠️ 인증 도입 전 임시(user 테이블 없음. `user`는 PG 예약어라 컬럼명 username, API에선 `user`로 노출) |
| problem_id FK, **problem_title** | ⚠️ problem_title은 mock 이관에서 온 **비정규화 중복** — 정규화 refine 후보 |
| result | TEXT — "맞았습니다"/"채점 중" 등 한국어 라벨(hub 도메인 JudgeResult enum의 label과 일치) |
| exec_time / exec_memory | TEXT — ⚠️ 수치화 refine 예정 (API에선 `time`/`memory`로 노출) |
| language, length, submittedAt | 제출 메타 |

## 설계 의도와 부채 (정직 기록)

- **의도**: M1 슬라이스에서 arena가 쓰던 mock 형태를 그대로 스키마로 옮겨 **프론트 무변경 교체(drop-in)** 를 우선했다. 정규화·수치화보다 세로 슬라이스 완주가 먼저.
- **알려진 부채** (TODO Deferred 추적): ① `timeLimit`/`memoryLimit`/`Submission.time·memory` 문자열 → 수치(ms·MB) ② `Submission.problemTitle` 비정규화 제거 ③ `user` 문자열 → User 모델+FK(인증 도입 시) ④ `result` 한국어 리터럴 → enum/코드화 검토(judge IDL 확정 시 함께).

## 예정 스키마 (착수 시 이 문서에 추가)

- **scout**: `problem_embeddings`(pgvector) — 문제 텍스트 임베딩, 유사도 검색 인덱스. 문제 원문은 hub 이벤트/API로 수신(직접 조인 금지).
- **setter**: 파이프라인 상태머신(초안 문제·scout 판정·교차검증 결과·검수 대기/승인) — 승인 시 hub admin API로 공개 이관.
- **hub 확장**: User(인증), Ranking(Redis sorted set과 역할 분담 정의 필요), Contest.

## 갱신 이력

- 2026-07-25 14:07 — hub Kotlin 전환([ADR-0007](../decisions/0007-backend-kotlin-return.md)) 반영: 스키마 실물 Prisma → **Flyway V1/V2**(snake_case, 예약어 회피: `username`·`ord`·`exec_time`), 소유권 표기 R2DBC+Flyway.
- 2026-07-25 12:48 — 문서 신설. 현행 3모델(problem/example/submission) + 소유권 지도 + 부채 기록.
