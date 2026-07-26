# AI 기반 알고리즘 문제 생성 및 코딩 테스트 플랫폼

> **프로젝트 성격**: 넓은 기술 스택을 단계적으로 학습·구현하기 위한 아키텍처 청사진입니다.
> 모든 컴포넌트를 한 번에 구축하지 않고, 아래 [16. 마일스톤](#16-마일스톤단계적-구현-로드맵)의 우선순위에 따라 세로 슬라이스 단위로 구현합니다.
>
> **로컬 실행법**: [RUN.md](RUN.md)

## 1. 프로젝트 개요

알고리즘 문제 데이터를 기반으로 AI가 새로운 코딩 테스트 문제를 생성하고, 생성된 문제를 자동 검증한 뒤 **사람이 최종 검수**하여 사용자에게 제공하는 알고리즘 플랫폼.

## 주요 기능

- 알고리즘 문제 데이터 수집 및 분석
- AI 기반 신규 알고리즘 문제 생성
- 기존 문제와의 유사도 검증
- 생성 문제 품질 검증 (정답 교차검증 포함)
- 생성 문제 사람 검수 게이트
- 온라인 코딩 테스트 환경 제공
- 자동 채점 시스템 제공


# 2. 시스템 구성

```
                     Algorithm Problem Dataset
          (Baekjoon / Programmers / LeetCode 등)
              ※ 데이터 라이선스 확인 필요 (14. 리스크 참고)
                                |
                                v

          +--------------------------------+
          | problem — 생성 모듈             |
          | Python + FastAPI               |
          | LLM API + LangChain            |
          | (파이프라인 지휘자)             |
          +--------------------------------+

                                |
                +---------------+---------------+
                |                               |
                v                               v

    +--------------------------+    +--------------------------+
    | plagiarism (독립 서비스)       |    | problem — 검증 모듈        |
    | Python + FastAPI         |    | (구 tester, ADR-0006 병합)|
    | Sentence Transformer     |    | LLM + judge batch 레인    |
    | (자체 임베딩 모델)        |    | 정답 교차검증(N-풀이 일치)|
    | pgvector                 |    | Test Case Validation     |
    +--------------------------+    +--------------------------+

                |                               |
                +---------------+---------------+
                                |
                                v

                     +-------------------------+
                     | Human Review Gate       |
                     | 생성 문제 사람 검수      |
                     | (승인 시에만 노출)       |
                     +-------------------------+

                                |
                                v

          +----------------+
          | Problem DB     |
          | PostgreSQL     |
          | + pgvector     |
          +----------------+

                |
                v

          Online Coding Platform

                |
      +---------+---------+
      |                   |
      v                   v
+----------------------+    +---------------------------+
| Frontend (web)     |    | Backend API (api)         |
| Next.js              |    | Kotlin + Spring Boot      |
| TypeScript           |    | WebFlux·코루틴·R2DBC      |
| Monaco Editor        |    | 계약: OpenAPI codegen     |
+----------------------+    +---------------------------+
                                  |
                                  v

                     +-------------------------+
                     | Database                |
                     | PostgreSQL              |
                     | Redis                   |
                     +-------------------------+

                                  |
                                  v

                     +-------------------------+
                     | Message Queue           |
                     | Apache Kafka            |
                     +-------------------------+

                                  |
                                  v

                     +-------------------------+
                     | Judge System            |
                     | Go                      |
                     | Worker                  |
                     +-------------------------+

                                  |
                                  v

                     +-------------------------+
                     | Sandbox Environment     |
                     | Docker (격리 강화)       |
                     | C++ / Java / Python     |
                     | Code Execution          |
                     +-------------------------+

                                  |
                                  v

                     결과 → Kafka(결과 토픽) → api 소비
                          → DB 저장 + SSE로 web 실시간 푸시
```

> **서비스 이음새 규칙([ADR-0006](docs/decisions/0006-service-seams-and-ai-consolidation.md))**: ① judge는 DB 접근 금지 — 결과는 Kafka 이벤트로만, api가 소비해 저장·SSE 푸시 ② DB 스키마당 단일 작성자(api=코어 / plagiarism=임베딩 / problem=파이프라인) ③ 실행 QoS 3레인 — `run`(예제 실행, 저지연)/`submit`(정식 제출)/`batch`(problem 검증, 최저 우선) 분리로 배치가 유저 제출을 굶기지 않음 ④ 오프라인 파이프라인 지휘자 = problem ⑤ 사람 검수 UI = web admin 라우트 + api admin API ⑥ Redis = 제출 rate limit·랭킹 sorted set·SSE 팬아웃 pub/sub.
>
> **채점 이음새 구현 방식([ADR-0009](docs/decisions/0009-judge-kickoff-async-and-contracts.md))**: 테스트케이스는 **claim-check** — MinIO 번들에 두고 메시지에는 참조(키+해시)만, judge는 해시 기준 로컬 캐시. 계약은 **Protobuf**(루트 [`contracts/`](contracts/), [ADR-0010](docs/decisions/0010-contracts-root-group.md)). 토픽: `submission.{run,submit,batch}` + `submission.result`.

# 3. AI Problem Generation Service

> **서비스 매핑**: `problem`의 **생성 모듈**. problem는 이 장(생성)과 5장(품질 검증)을 내부 모듈로 갖는 단일 서비스이며, 오프라인 파이프라인의 지휘자다([ADR-0006](docs/decisions/0006-service-seams-and-ai-consolidation.md)).

## 목적

기존 알고리즘 문제 데이터를 분석하여 새로운 코딩 테스트 문제 생성.

## 주요 기능

- 알고리즘 유형 분석
- 난이도 분석
- 문제 구조 분석
- 문제 스토리 생성
- 입력/출력 조건 생성
- 제한 조건 생성
- 예상 풀이 알고리즘 생성
- 테스트 케이스 생성

## 접근 방식

문제 **생성**은 자체 모델 파인튜닝 대신 **LLM API 호출**로 처리한다. 파인튜닝은 양질의 데이터셋·GPU·품질 확보 난이도가 사이드 범위를 벗어나며, 범용 LLM 대비 품질 이점이 없기 때문이다. 대신 **LangChain 기반 프롬프트 체이닝·오케스트레이션** 학습에 집중한다.

## 기술 스택

| 구분 | 기술 |
|---|---|
| Language | Python |
| Framework | FastAPI |
| LLM | LLM API (예: OpenAI / Anthropic 등) |
| LLM Framework | LangChain |
| Database | PostgreSQL |


# 4. Problem Similarity Validator

> **서비스 매핑**: `plagiarism` (독립 서비스). 임베딩 모델을 메모리에 상주시키는 서빙 워크로드라 자원 특성이 달라 유일하게 분리를 유지한다([ADR-0006](docs/decisions/0006-service-seams-and-ai-consolidation.md)).

## 목적

생성된 문제가 기존 알고리즘 문제와 지나치게 유사한지 검증.

## 주요 기능

- 문제 Embedding 생성 (자체 소형 모델)
- Vector Similarity 검색 (pgvector)
- 기존 문제와 유사도 계산
- Threshold 기반 문제 폐기
- 유사 문제 이력 관리

## 접근 방식

임베딩은 **자체 소형 모델(Sentence Transformer 계열)**을 로컬에서 구동한다. 수백 MB 규모라 GPU 없이 CPU로도 동작하며, PyTorch / HuggingFace Transformers 생태계를 실제로 학습하는 지점이다. 생성된 벡터는 **pgvector**에 저장·검색하여 별도 벡터 인프라 없이 PostgreSQL 하나로 통합한다.

## 처리 흐름

```
Generated Problem

    ↓

Embedding 생성 (자체 Sentence Transformer)

    ↓

pgvector Similarity 검색

    ↓

Similarity Score 계산

    ↓

기준 초과 시 Problem Reject
```

## 기술 스택

| 구분 | 기술 |
|---|---|
| Language | Python |
| Framework | FastAPI |
| NLP Model | Sentence Transformer (자체 구동, PyTorch / HuggingFace) |
| Vector Store | pgvector (PostgreSQL 확장) |


# 5. Problem Validator

> **서비스 매핑**: `problem`의 **검증 모듈**(구 `tester` — 독립 서비스에서 병합, [ADR-0006](docs/decisions/0006-service-seams-and-ai-consolidation.md)). 대량 실행은 judge의 `batch` 레인을 재사용한다(샌드박스 이중 구현 금지).

## 목적

생성된 문제가 실제 코딩 테스트 문제로 적합한지 검증.

## 검증 항목

- 문제 조건 오류 검사
- 알고리즘 풀이 가능 여부
- 예상 풀이 생성 가능 여부
- 테스트 케이스 검증
- 난이도 적합성 검증
- 실행 결과 검증

## 정답 신뢰성 확보 (핵심)

단일 LLM이 "풀이를 생성해 통과하면 OK"로 판정하면, 같은 LLM이 지문을 동일하게 오해할 경우 검증이 무력화된다. 이를 막기 위해 다음을 적용한다:

- **교차검증(N-풀이 일치)**: 서로 다른 세션/모델로 여러 풀이를 독립 생성하고, **출력이 모두 일치할 때만** 기대 정답으로 채택한다.
- **제한조건 변별력 검사**: brute-force 풀이와 최적 풀이를 모두 실행하여, 제한조건(시간/메모리)이 실제로 두 풀이를 구분하는지 확인한다.
- **사람 검수 게이트**: 자동 검증을 통과해도 사용자 노출 전 사람이 최종 검수하여 승인한 문제만 공개한다.

## 처리 흐름

```
Generated Problem

    ↓

LLM Problem Analysis

    ↓

Solution Code Generation (N개 독립 생성)

    ↓

Test Case Generation

    ↓

Judge Execution (N-풀이 출력 일치 확인)

    ↓

Validation Result

    ↓

Human Review Gate (승인 시에만 공개)
```

## 기술 스택

| 구분 | 기술 |
|---|---|
| Language | Python |
| Framework | FastAPI |
| Execution Environment | Docker |


# 6. Online Coding Platform

## 목적

사용자가 알고리즘 문제를 조회하고 코드를 작성 및 제출하는 서비스.

## 주요 기능

- 문제 목록 조회
- 문제 상세 조회
- 코드 작성
- 코드 제출
- 채점 결과 조회
- 풀이 기록 관리
- 사용자 랭킹
- 문제 통계


# 7. Frontend Service

## 기술 스택

| 구분 | 기술 |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| UI | Tailwind CSS |
| Code Editor | Monaco Editor |

## 아키텍처

자체 정의 도메인 레이어드 (`app → views → entities → shared`, 단방향 의존) + MVVM + Server Actions. RSC는 정적 화면만 부분 적용. 상세: [docs/architecture/web.md](docs/architecture/web.md), [docs/decisions/0004](docs/decisions/0004-frontend-architecture.md).


# 8. Backend API Service

## 목적

사용자 서비스 및 플랫폼 비즈니스 로직 담당.

## 주요 기능

- 회원 관리
- 인증/인가
- 문제 관리
- 제출 관리
- 풀이 기록 관리
- 랭킹 관리
- 사용자 통계

## 기술 스택

| 구분 | 기술 |
|---|---|
| Language | Kotlin (JDK 21 LTS) |
| Framework | Spring Boot 4.0.x — **WebFlux + 코루틴**(suspend) |
| 데이터 접근 | **R2DBC** (논블로킹 Postgres) |
| 마이그레이션 | Flyway (스키마+시드, 기동 시 자동) |
| 아키텍처 | **Hexagonal** (domain/port → application → adapter) |
| 계약 | springdoc OpenAPI → web 타입 codegen + 컴파일타임 계약 체크 |
| 입력 검증 | jakarta validation + 도메인 enum |
| Security | (예정) — 인증/인가 후속 |
| Database | PostgreSQL |
| Cache | Redis |

> NestJS(ADR-0005)에서 **Kotlin+Spring으로 복귀** — 단, 실무(Java+Spring MVC/JPA) 재탕 금지 조항과 함께 모던 스택을 강제한다. 근거: [ADR-0007](docs/decisions/0007-backend-kotlin-return.md).


# 9. Judge System

## 목적

사용자가 제출한 코드를 격리된 환경에서 실행하고 결과를 반환하는 자동 채점 시스템.

## 주요 기능

- 코드 실행
- Compile Error 처리
- Runtime Error 처리
- Time Limit 검사
- Memory Limit 검사
- Test Case 비교
- 채점 결과 반환

## 샌드박스 보안 (핵심)

남의 코드를 실행하는 시스템이므로 Docker 컨테이너 하나로는 보안 경계가 되지 못한다. 다음을 반드시 갖춘다:

- **리소스 제한**: cgroups 기반 CPU/메모리/프로세스 수 제한, fork bomb 방어
- **네트워크 차단**: 컨테이너 외부 네트워크 egress 완전 차단
- **시스템콜 제한**: seccomp 프로파일 적용 (필요 시 gVisor / nsjail 등 격리 강화)
- **파일시스템**: read-only 마운트 + 임시 쓰기 영역 격리, 실행 후 폐기
- **실행 계정**: 비특권 사용자로 실행, 타임아웃 강제 종료

## 처리 흐름

```
User Submission
    ↓
api (rate limit — Redis)
    ↓
Kafka 제출 토픽 (QoS 3레인: run / submit / batch)
    ↓
Judge Worker (Go)
    ↓
Docker Sandbox 실행 → 판정
    ↓
Kafka 결과 토픽                ← judge는 DB에 쓰지 않는다
    ↓
api 소비 → DB 저장 → SSE로 web 실시간 푸시
```

- **QoS 3레인**: `run`(예제 실행, 인터랙티브 저지연) / `submit`(정식 제출) / `batch`(problem의 교차검증 대량 실행, 최저 우선순위). 배치가 유저 제출을 굶기지 않는다.
- **결과는 이벤트로만**: judge가 DB에 직접 쓰면 Go와 Kotlin(api)이 스키마를 이중 소유하게 되므로 금지([ADR-0006](docs/decisions/0006-service-seams-and-ai-consolidation.md)).

## 기술 스택

| 구분 | 기술 |
|---|---|
| Language | Go |
| Message Queue | Kafka |
| Container | Docker |


# 10. Database

> **단일 작성자 원칙([ADR-0006](docs/decisions/0006-service-seams-and-ai-consolidation.md))**: 스키마당 주인 하나 — 코어=api(R2DBC+Flyway), 임베딩=plagiarism, 출제 파이프라인=problem, **judge=DB 접근 금지(이벤트만)**. 교차 접근은 API/이벤트로. Redis 용도는 ① 제출 rate limit ② 랭킹 sorted set ③ SSE 팬아웃 pub/sub.

## Main Database (PostgreSQL)

- User
- Problem
- Problem Category
- Submission
- Test Case
- Solved Problem
- Ranking
- Contest

## AI Database (PostgreSQL + pgvector)

- Problem Embedding
- Generated Problem History
- Similarity Result
- Validation Result
- Human Review Log


# 11. Infrastructure

## 기술 스택

| 구분 | 기술 |
|---|---|
| Cloud | AWS |
| Container | Docker |
| Orchestration | Docker Compose (초기) → Kubernetes (후속) |
| CI/CD | GitHub Actions |
| Reverse Proxy | Nginx |


# 12. Final Technology Stack

| 영역 | 기술 |
|---|---|
| Frontend | Next.js + TypeScript |
| Backend API | Kotlin + Spring Boot (WebFlux·코루틴·R2DBC·Flyway, Hexagonal) |
| AI Service | Python + FastAPI |
| 문제 생성 | LLM API + LangChain |
| 임베딩/NLP | Sentence Transformer (PyTorch / HuggingFace, 자체 구동) |
| Vector Store | pgvector (PostgreSQL 확장) |
| Main Database | PostgreSQL |
| Cache | Redis |
| Message Queue | Kafka |
| Judge Server | Go |
| Sandbox | Docker (격리 강화) |
| Object Storage | MinIO (S3 호환) — 테스트케이스 번들(claim-check) |
| IDL | Protobuf (루트 `contracts/`) — api↔judge, (M3~) api↔AI |
| Deployment | Docker Compose (초기) → Kubernetes (후속) |
| Cloud | AWS |


# 13. 아키텍처 결정 기록 (요약)

| 결정 | 채택 | 배제/보류 | 이유 |
|---|---|---|---|
| Backend API | Kotlin + Spring (모던 스택 강제) | NestJS(0005), Go, MVC/JPA | 코루틴·WebFlux·R2DBC·Hexagonal은 실무(Java+Spring MVC)와 다른 패러다임 — 신규 학습 성립. 계약은 OpenAPI codegen([ADR-0007](docs/decisions/0007-backend-kotlin-return.md)) |
| 버전 정책 | LTS/안정판 (JDK 21, Boot 4.0.x, Node 22, PG 16) | 최신 첫 릴리스 | "최신이 무조건 좋은 건 아니다" — 패치가 쌓인 선 선택 |
| 로컬 도커 | 인프라만 컨테이너(개발용) | 앱 컨테이너 | 앱은 네이티브 실행(핫리로드·디버거), 컨테이너화는 배포 시(M5) |
| 문제 생성 | LLM API | 자체 모델 파인튜닝 | 데이터·GPU·품질 확보 난이도가 과함 |
| 임베딩 | 자체 Sentence Transformer | 임베딩 API | ML 생태계 실제 학습 목적 |
| 벡터 저장 | pgvector | FAISS / Milvus | PostgreSQL로 통합, 인프라 최소화 |
| LLM 프레임워크 | LangChain | LlamaIndex | 생성 파이프라인 오케스트레이션에 적합 |
| 메인 DB | PostgreSQL | MySQL | AI 서비스와 통일, pgvector 활용 |
| 배포 | Docker Compose (초기) | Kubernetes (후속) | 초기 완주율 우선, 트래픽 발생 후 이관 |
| AI 서비스 분해 | problem/plagiarism 2분할 | 3분할(tester 독립) | 생성·검증은 한 파이프라인(경계는 스케일 특성에만) — plagiarism만 모델 서빙이라 독립 |
| 채점 결과 경로 | Kafka 결과토픽 → api → SSE | judge 직접 DB 쓰기, WebSocket | 폴리글랏 스키마 이중 소유 방지, 단방향 알림엔 SSE로 충분 |
| 채점 착수 경로 | Kafka 직행 (구 M1/M2 통합) | 동기 HTTP 채점 선행 | 이음새가 이미 Kafka로 확정([ADR-0006](docs/decisions/0006-service-seams-and-ai-consolidation.md)) — 대체가 결정된 동기 단계는 폐기 코드([ADR-0009](docs/decisions/0009-judge-kickoff-async-and-contracts.md)) |
| 테스트케이스 전달 | claim-check (MinIO 번들 + 메시지엔 키·해시) | 메시지 인라인, judge→api HTTP 조회 | Kafka 1MB 상한·반복 운반 / 동기 결합 재도입 — 참조+로컬 캐시가 표준([ADR-0009](docs/decisions/0009-judge-kickoff-async-and-contracts.md)) |
| api↔judge IDL | Protobuf (루트 `contracts/`) | Avro+Schema Registry(보류), JSON Schema | Go 코드젠 1급 + AI 경계(M3~)까지 단일 IDL. Registry는 추후 추가 가능([ADR-0009](docs/decisions/0009-judge-kickoff-async-and-contracts.md), [0010](docs/decisions/0010-contracts-root-group.md)) |
| 파이프라인 오케스트레이션 | problem 내 상태머신 | Airflow 등 워크플로 엔진 | 파이프라인 1개 규모에 엔진은 과설계 |


# 14. 리스크 및 주의사항

- **데이터 라이선스 (최우선)**: 백준·프로그래머스·LeetCode 문제 수집·활용은 각 사이트 ToS 및 저작권 이슈가 있다. 개인 학습용과 서비스 제공은 다르므로, 사용 가능한 공개 데이터셋 확보 또는 자체 시드 문제 구축 방안을 먼저 확정한다.
- **생성 문제 신뢰성**: LLM 생성물은 지문 모호·조건 오류·정답 불일치가 흔하다. 5장의 교차검증 + 사람 검수 게이트 없이 자동 공개 금지.
- **LLM API 비용**: 생성·검증마다 다회 호출이 발생하므로 호출량·캐싱·배치 전략을 초기부터 관리한다.
- **샌드박스 보안**: 9장의 격리 요건은 선택이 아닌 필수. 미비 시 서버 침해로 직결된다.


# 15. 데이터 흐름 요약

```
데이터셋 → 생성(LLM API) → 유사도 검증(임베딩/pgvector)
        → 품질 검증(교차검증/Judge) → 사람 검수 → 공개
        → 사용자 제출 → Kafka → Go Judge → Docker Sandbox → 결과 저장
```


# 16. 마일스톤(단계적 구현 로드맵)

넓은 스택을 한 번에 세우지 않고, 각 단계마다 **동작하는 세로 슬라이스**를 완성한다.

| 단계 | 목표 | 범위 |
|---|---|---|
| **M1** | 온라인 채점 코어(비동기) | Next.js(web) + Kotlin/Spring(api) + PostgreSQL, 수기 등록 문제, Go Judge + Sandbox, **Kafka 제출·결과 토픽(QoS 3레인) + MinIO claim-check** — 구 M1(동기)+M2(Kafka)를 통합, 동기 채점 단계 폐지([ADR-0009](docs/decisions/0009-judge-kickoff-async-and-contracts.md)) |
| **M2** | 채점 스케일아웃 | Judge Worker 수평 확장, SSE Redis pub/sub 전환, 제출량 처리 |
| **M3** | AI 생성 파이프라인 | LLM API + LangChain 생성, 사람 검수 게이트 |
| **M4** | 유사도/품질 검증 | 자체 임베딩 + pgvector 유사도, 정답 교차검증 자동화 |
| **M5** | 운영 고도화 | Kubernetes 이관, 모니터링/로깅, 랭킹·통계·콘테스트 |
