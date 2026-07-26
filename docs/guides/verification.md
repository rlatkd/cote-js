# 검증 체크리스트 (Verification)

> **이 프로젝트가 살아있음을 확인하는 절차.** [RUN.md](../../RUN.md)가 "켜는 법"이라면 이 문서는 "확인하는 법"이다. Claude는 구현 작업 후 이 절차로 검증하고, **서비스·기능이 추가되어 절차가 바뀌면 이 문서를 같은 흐름에서 갱신한다**(갱신 시 아래 이력에 날짜·시각 기입).

## 현재 절차 (M1 슬라이스: api(Kotlin) + web)

### 0. 사전
```bash
cd infra && docker compose up -d          # Postgres :5432 · Kafka :9092 · MinIO :9000 (healthy 대기)
docker exec cotejs-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list  # 토픽 4종
```

### 1. api — 빌드·기동·API 스모크 (:4000)
```bash
cd services/api && ./gradlew compileKotlin      # 컴파일 에러 0
./gradlew bootRun                                # 기동 로그: Flyway 마이그레이션 적용 + Started, ERROR 없음
curl -s localhost:4000/api/problems | head -c 200          # 200, JSON 배열(시드 7문제)
curl -s localhost:4000/api/problems/1000 | head -c 200     # 200, 단건(examples 포함)
curl -s -o /dev/null -w "%{http_code}" localhost:4000/api/problems/999999   # 404
curl -s localhost:4000/api/submissions | head -c 200       # 200, 최신순
curl -s -X POST localhost:4000/api/submissions -H "content-type: application/json" \
  -d '{"problemId":1000,"language":"Python","code":"print(1)"}'             # 201, result="채점 중"
curl -s -o /dev/null -w "%{http_code}" -X POST localhost:4000/api/submissions \
  -H "content-type: application/json" -d '{}'                              # 400 (검증)
curl -s -o /dev/null -w "%{http_code}" -X POST localhost:4000/api/submissions \
  -H "content-type: application/json" -d '{"problemId":1000,"language":"Rust","code":"x"}'  # 400 (잘못된 언어)
curl -s -o /dev/null -w "%{http_code}" localhost:4000/api/v3/api-docs       # 200 (OpenAPI)
```

### 2. 계약 정합 (api 응답 계약을 바꿨을 때만)
```bash
cd services/web && pnpm gen:api          # schema.d.ts 재생성 → git diff 확인 → 커밋
# contract-check.ts가 모델과 어긋나면 아래 3의 next build가 실패한다(의도된 동작)
```

### 3. web — 빌드 + 실렌더 (:3000)
```bash
cd services/web && pnpm build            # next build 통과(계약 체크 포함)
pnpm dev
for p in / /problems /problems/1000 /status; do
  curl -s -o /dev/null -w "$p -> %{http_code}\n" http://localhost:3000$p; done   # 전부 200
# HTML에 api 시드 데이터 반영 확인 (예: "두 수의 합")
```
- 눈 확인(주요 UI 변경 시): 라이트/다크 토글, split view 리사이즈, Monaco 로딩, 제출 시 stub 결과 표시.

### 4. 품질 게이트
```bash
cd services/web && pnpm lint             # ESLint(레이어 의존 규칙 포함)
```

### 5. judge — 채점 코어 (Kafka·MinIO 없이 관통, [judgecli](../../services/judge/cmd/judgecli))

```bash
cd services/judge && go vet ./... && go build ./...        # 컴파일·정적검사 그린
cd runners/python && docker build -t cotejs-judge-python:3.12 .   # 러너 이미지(러너 변경 시)

# 번들 준비: <dir>/cases/01.in, 01.out, ... (A+B 3케이스 등)
go run ./cmd/judgecli -bundle <dir> -source <풀이.py> -time-ms 1000 -mem-mb 256
```

판정 시나리오 — 5종이 각각 의도한 Verdict로 나와야 한다:

| 제출 코드 | 기대 판정 |
|---|---|
| 정답 풀이 | `ACCEPTED` |
| 틀린 연산(`a-b`) | `WRONG_ANSWER` |
| `while True: pass` | `TIME_LIMIT_EXCEEDED` |
| 대용량 할당(`[0]*300MB`) | `MEMORY_LIMIT_EXCEEDED` |
| `1 // 0` | `RUNTIME_ERROR` |

샌드박스 격리 — 탈출하지 못해야 한다:

| 제출 코드 | 기대 결과 |
|---|---|
| `urllib.request.urlopen("http://example.com")` | 외부 통신 실패(현상은 DNS 대기 → `TIME_LIMIT_EXCEEDED`), "escaped" 출력 없음 |
| fork bomb(`while True: os.fork()`) | `--pids-limit`에 막혀 `RUNTIME_ERROR`, 호스트 영향 없음 |

### 6. judge — 파이프라인 관통 (Kafka + MinIO)

```bash
# 계약 정합 (proto를 바꿨을 때)
cd contracts && buf lint && buf breaking --against '../.git#branch=main,subdir=contracts' && buf generate
#   → services/judge/gen/* 재생성 → git diff 확인 → 커밋

cd services/judge && go vet ./... && go build ./...
go run ./cmd/judged                     # 워커 기동 (다른 터미널)
go run ./cmd/judgeprobe -bundle <dir> -source <풀이.py> -lane submit -submission 9001
```

확인 항목:

| 항목 | 기대 |
|---|---|
| 왕복 | probe가 결과 JSON 수신 — verdict·케이스별 결과 포함 |
| 번들 캐시 | 같은 번들 2회차에 다운로드 생략(로그의 소요시간 감소), 캐시 디렉토리명 = sha256, `.complete` 존재 |
| QoS 레인 | 워커를 멈춘 채 `-no-wait`로 batch·batch·submit·run 순 적재 → 워커 기동 시 **run → submit → batch → batch** 순 처리 |
| 장애 내성 | 워커를 채점 도중 죽였다 재기동 → 해당 제출이 **재채점**됨(at-least-once, 유실 없음) |

> **함정**: 워커 로그를 `| head -N`으로 파이프하면 버퍼링 때문에 로그가 보이지 않는다(메시지는 이미 소비됨). 순서 검증은 파이프 없이.

## 추가 예정 (해당 마일스톤 착수 시 이 문서에 절차 추가)

- **api 테스트 스위트**: Kotest + Testcontainers 도입 시 `./gradlew test`를 게이트에 추가
- **api 배선**: 제출 API → Kafka 프로듀스, 결과 소비 → DB 멱등 저장(중복 결과 1건으로), JVM proto 생성물 정합
- **SSE**: 제출 후 web가 폴링 없이 결과 수신
- **problem/plagiarism**: 파이프라인 상태 전이, 유사도 질의 왕복

## 갱신 이력

- 2026-07-26 20:21 — judge 파이프라인 절차(6) 신설: buf 계약 검사(lint·breaking·generate) + judged/judgeprobe 왕복·캐시·QoS·at-least-once 확인. `head` 파이프 함정 명시.
- 2026-07-26 20:05 — judge 코어 절차(5) 신설: judgecli 판정 5종 + 샌드박스 격리 2종. 인프라 사전 단계에 Kafka·MinIO 추가.

- 2026-07-25 14:07 — api Kotlin 전환([ADR-0007](../decisions/0007-backend-kotlin-return.md)) 반영: contracts 빌드 단계 삭제 → gradle 컴파일·기동 + OpenAPI/계약 정합(gen:api) 단계로 교체.
- 2026-07-25 12:48 — 문서 신설. M1 슬라이스(contracts/api/web) 절차 정리.
