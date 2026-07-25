# 데이터 모델

> **스키마의 실물은 [`platform/hub/prisma/schema.prisma`](../../platform/hub/prisma/schema.prisma)** — 이 문서는 관계·소유권·설계 의도를 설명한다. 스키마가 바뀌면 이 문서를 같은 흐름에서 갱신한다(하단 이력에 날짜·시각).

## 소유권 지도 ([ADR-0006](../decisions/0006-service-seams-and-ai-consolidation.md) — 스키마당 단일 작성자)

| 영역 | 주인(유일 작성자) | 상태 |
|---|---|---|
| 코어: Problem·Example·Submission (+ 추후 User·Ranking·Contest) | **hub** (Prisma) | **구현됨** |
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
| submissionCount / acceptedCount | Int | 정답률 계산은 contracts의 순수 함수 |
| tags | String[] | Postgres 배열 |
| aiGenerated | Boolean | AI 생성 표식 |
| starterCode | Json | 언어별 시작 코드 맵 |

### Example — 예제 입출력

`problemId` FK + `order`(표시 순서). 문제 삭제 시 연쇄 삭제(Cascade).

### Submission — 제출

| 필드 | 비고 |
|---|---|
| user | String — ⚠️ 인증 도입 전 임시(User 모델 없음) |
| problemId FK, **problemTitle** | ⚠️ problemTitle은 mock 이관에서 온 **비정규화 중복** — 정규화 refine 후보 |
| result | String — "맞았습니다"/"채점 중" 등 한국어 리터럴(contracts JudgeResult와 일치) |
| time / memory | String — ⚠️ 수치화 refine 예정 |
| language, length, submittedAt | 제출 메타 |

## 설계 의도와 부채 (정직 기록)

- **의도**: M1 슬라이스에서 arena가 쓰던 mock 형태를 그대로 스키마로 옮겨 **프론트 무변경 교체(drop-in)** 를 우선했다. 정규화·수치화보다 세로 슬라이스 완주가 먼저.
- **알려진 부채** (TODO Deferred 추적): ① `timeLimit`/`memoryLimit`/`Submission.time·memory` 문자열 → 수치(ms·MB) ② `Submission.problemTitle` 비정규화 제거 ③ `user` 문자열 → User 모델+FK(인증 도입 시) ④ `result` 한국어 리터럴 → enum/코드화 검토(judge IDL 확정 시 함께).

## 예정 스키마 (착수 시 이 문서에 추가)

- **scout**: `problem_embeddings`(pgvector) — 문제 텍스트 임베딩, 유사도 검색 인덱스. 문제 원문은 hub 이벤트/API로 수신(직접 조인 금지).
- **setter**: 파이프라인 상태머신(초안 문제·scout 판정·교차검증 결과·검수 대기/승인) — 승인 시 hub admin API로 공개 이관.
- **hub 확장**: User(인증), Ranking(Redis sorted set과 역할 분담 정의 필요), Contest.

## 갱신 이력

- 2026-07-25 12:48 — 문서 신설. 현행 3모델(Problem/Example/Submission) + 소유권 지도 + 부채 기록.
