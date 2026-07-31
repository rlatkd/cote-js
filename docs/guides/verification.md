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
cd services/api  && ./gradlew build      # 컴파일 + 단위(13) + 통합(3, Testcontainers Postgres)
cd services/judge && go test ./...       # 단위 8종(판정 규칙·언어 명세)
cd services/web   && pnpm lint           # ESLint(레이어 의존 규칙 포함)
cd contracts      && buf lint            # 계약 스타일
```

> **이 절차는 [CI](../../.github/workflows/ci.yml)가 PR마다 자동 실행한다.** 손으로 도는 건 빠른 확인용이고,
> 강제는 CI가 한다 — 규약을 사람의 규율에 맡기지 않는 것이 요점([ADR-0016](../decisions/0016-test-strategy.md)).
> CI가 **하지 않는 것**: 샌드박스 실채점·전 구간 E2E(느리고 flaky) → 아래 5~7의 수동 절차로 남긴다.

### 5. judge — 채점 코어 (Kafka·MinIO 없이 관통, [judgecli](../../services/judge/cmd/judgecli))

```bash
cd services/judge && go vet ./... && go build ./... && go test ./...   # 정적검사 + 단위 테스트
# 러너 이미지(러너·하니스 변경 시) — 빌드 컨텍스트는 services/judge
docker build -f runners/python/Dockerfile     -t cotejs-judge-python:3.12 .
docker build -f runners/java/Dockerfile       -t cotejs-judge-java:21     .
docker build -f runners/javascript/Dockerfile -t cotejs-judge-node:22     .

# 번들 준비: <dir>/cases/01.in, 01.out, ... (A+B 3케이스 등)
go run ./cmd/judgecli -bundle <dir> -source <풀이.py> -time-ms 1000 -mem-mb 256
```

언어별 판정 시나리오 — `-lang python|java|javascript`로 각각 확인한다:

| 제출 코드 | 기대 판정 |
|---|---|
| 정답 풀이 | `ACCEPTED` |
| 틀린 연산(`a-b`) | `WRONG_ANSWER` |
| `while True: pass` | `TIME_LIMIT_EXCEEDED` |
| 대용량 할당(`[0]*300MB`) | `MEMORY_LIMIT_EXCEEDED` |
| `1 // 0` | `RUNTIME_ERROR` |
| 문법 오류(닫히지 않은 괄호 등) | `COMPILE_ERROR` + **실제 컴파일러·파서 메시지** |
| 미지원 언어(`-lang cpp`) | `INTERNAL_ERROR` + "지원하지 않는 언어" (오판정이 아니라 명시적 실패) |

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

### 7. 전 구간 — web 제출 → 채점 → 실시간 표시

```bash
# 인프라 + api + judged + web 모두 기동한 상태에서 (문제 1000만 히든 테스트케이스가 있다)
SOLUTION='a, b = map(int, input().split())
print(a + b)
'
curl -s -X POST localhost:4000/api/submissions -H "content-type: application/json"   -d "{\"problemId\":1000,\"language\":\"Python\",\"code\":\"$SOLUTION\"}"   # 201, result="채점 중"
curl -s localhost:4000/api/submissions | head -c 300   # 잠시 후 "맞았습니다" + execTimeMs/memoryUsedKb
```

| 항목 | 확인 방법 | 기대 |
|---|---|---|
| SSE | `curl -sN localhost:4000/api/submissions/stream` 를 띄운 채 제출 | `채점 중` → 최종 판정 두 이벤트 수신 |
| 멱등성(at-least-once의 짝) | `KAFKA_GROUP=idempotency-probe ./gradlew bootRun` 으로 재기동(결과 토픽 전량 재소비) | DB 완전 불변(건수·판정·`judged_at`까지) |
| 타임존 | 응답의 `submittedAt` vs `judgedAt` | 초 단위 차이(9시간 어긋나면 회귀) |
| 번들 발행 | `docker exec cotejs-minio mc ls local/testdata/bundles` 또는 콘솔 :9001 | 제출 후 `<sha256>.tgz` 존재 |
| 화면 | http://localhost:3000/status 를 열어둔 채 제출 | 새로고침 없이 행이 추가되고 판정으로 갱신 |
| **실행 모드** | `"mode":"run"`으로 제출(히든 케이스 없는 문제도 가능) | 공개 예제로 채점 · judge 로그에 `lane=submission.run` · **채점 현황 목록에는 안 보임** |
| **케이스별 결과** | 일부 케이스만 틀리는 풀이 제출 | 응답 `cases[]`에 케이스별 판정(예: 3번만 `틀렸습니다`) |
| **추적 전파** | 제출 후 api 로그의 `trace=` 값을 judge 로그에서 검색 | **같은 `trace_id`**가 양쪽에 존재 |
| 채점 불가 처리 | 테스트케이스 없는 문제(예: 2231)에 제출 | `채점 오류`(오답류가 아님) |

### 8. 관측 — 분산 추적·상관관계 로깅 ([ADR-0018](../decisions/0018-observability-tracing.md))

**원리**: id 하나를 손으로 지정해 전 구간에서 재발견되는지 본다 — "동작하는 것처럼 보임"과 "실제로 이어짐"은 다르다.

```bash
# 인프라(jaeger 포함) + api(bootRun=에이전트 부착) + judged 기동 상태에서,
# trace_id를 직접 지정해 제출 (web을 거치면 Next 서버가 이 헤더를 만들어 보낸다)
curl -s -X POST localhost:4000/api/submissions \
  -H "content-type: application/json" \
  -H "traceparent: 00-cafe1234cafe1234cafe1234cafe1234-a1b2c3d4e5f60718-01" \
  -d '{"problemId":1000,"language":"Python","code":"a,b=map(int,input().split())\nprint(a+b)","mode":"submit"}'
```

| 항목 | 확인 방법 | 기대 |
|---|---|---|
| api MDC | api 콘솔에서 `cafe1234` 검색 | `INFO [cafe1234...]` — 요청·컨슈머 문맥의 **모든** 라인에 대괄호 id. `발행` 라인에 `parentSpan=a1b2c3d4e5f60718`(웹 헤더의 span) |
| judge 로그 | judged 콘솔에서 `cafe1234` 검색 | `채점 시작`·`채점 완료` 라인에 `trace_id=cafe1234... submission_id=...` |
| 스팬 트리 | `curl -s localhost:16686/api/traces/cafe1234cafe1234cafe1234cafe1234` 또는 UI :16686 | **api**(POST·SELECT/INSERT·Kafka publish·result process)와 **judge**(`judge submission.submit`, verdict 태그)가 **한 추적**에 |
| 깨진 헤더 방어 | 대문자·전부 0 등 무효 traceparent로 제출 | api가 버리고 **새 trace 시작**(단위 테스트 `TraceContextTest`가 고정) |
| 관측 독립성 | jaeger 컨테이너 중지 후 제출 | 채점 정상(스팬만 유실) — 관측은 부가 기능 |

> **함정(실증)**: judge의 OTLP gRPC 익스포터 기본값은 TLS — 평문 Jaeger에는 핸드셰이크 실패로 스팬이 **조용히 전량 유실**된다(`WithInsecure` 필요). 스팬이 안 보이면 익스포터 오류 로그부터 확인.

### 9. 인증 — 카카오 OIDC·JWT·보호 경계 ([ADR-0019](../decisions/0019-authentication-kakao-oidc.md))

전제: `services/api/.env`에 카카오 자격 증명(bootRun이 주입), infra 기동.

| 항목 | 확인 방법 | 기대 |
|---|---|---|
| 마이그레이션(V5) | `docker exec cotejs-postgres psql -U cotejs -d cotejs -c "SELECT provider, count(*) FROM users GROUP BY 1"` | 시드 유저(provider='seed') 존재, `submission.user_id`는 `is_nullable=NO` |
| **401 가드** | 쿠키 없이 `POST /api/submissions` | `401 {"message":"로그인이 필요합니다"}` (run·submit 공통) |
| 세션 조회 | 쿠키 없이 `GET /api/auth/me` | 401 |
| 로그인 시작 | `curl -D - localhost:4000/api/auth/login/kakao` | 302 → kauth.kakao.com(…scope=openid profile_nickname&state=…&nonce=…) + `oauth_state` 서명 쿠키(HttpOnly·10m·path=/api/auth) |
| **실로그인(브라우저)** | :3000 → "카카오 로그인" → 동의 → 복귀 | Navbar에 `@닉네임`, `users`에 provider='kakao' 행, access(1h)·refresh(14d) httpOnly 쿠키 |
| 로그인 제출 | 로그인 상태로 문제 1000 제출 | 채점 정상 + `submission.user_id`=내 유저, `username`=카카오 닉네임 |
| 로그아웃 | Navbar 로그아웃 | 쿠키 만료, Navbar가 로그인 버튼으로, 제출 시 401 안내 |
| 토큰 정책(자동) | `JwtCodecTest`(6)·`IdTokenVerifierTest`(6) — CI 강제 | 만료·변조·타입 오용·alg 바꿔치기·nonce 불일치 전부 거부 |

### 10. M2 스케일아웃 — Redis 팬아웃·rate limit·레인 동시성 (2026-07-31)

| 항목 | 확인 방법 | 기대 |
|---|---|---|
| SSE via Redis | `curl -N /api/submissions/stream` 구독 중 제출 | 채점 중→판정 이벤트 수신(경로: api→Redis 채널→구독 인스턴스). `docker stop cotejs-redis` 상태에선 알림만 끊기고 채점 정상 |
| rate limit | 로그인 쿠키로 run 32연사 | **정확히 30×201 + 2×429**(`{"statusCode":429,...}`), 1분 후 리셋 |
| 페이지네이션 | `GET /api/submissions?limit=3&offset=3` | 3건, 최신순 연속 |
| 레인 동시성 | run 다건 적재 후 judged 로그 | `채점 시작`이 **같은 시각에 2건**(run 슬롯 2), batch는 1건씩 |
| V6 데이터 | `SELECT DISTINCT result FROM submission` / `starter_template` 3행 / `problem_title` 컬럼 부재 | 저장값=enum name, 응답은 여전히 한국어 라벨(계약 불변) |
| 스타터 병합 | `GET /api/problems/1000`의 `starterCode` | 3언어 — DB 오버라이드 NULL이어도 템플릿에서 채워짐 |

## 추가 예정 (해당 마일스톤 착수 시 이 문서에 절차 추가)

- **problem/plagiarism**: 파이프라인 상태 전이, 유사도 질의 왕복
- **인증 후속**: 남의 제출 코드 조회 차단 등 세부 인가 경계(현재는 조회 전면 공개 정책)

## 갱신 이력

- 2026-07-31 21:40 — 절차 10(M2·V6) 신설: Redis 팬아웃·rate limit 429·레인 동시성·저장값 코드화·스타터 병합.
- 2026-07-31 21:02 — 절차 9(인증) 신설: V5·401 가드·로그인 302·실로그인·소유 귀속·로그아웃 + 토큰 정책은 단위 테스트가 상시 강제.
- 2026-07-30 23:01 — 절차 8(관측) 신설: 지정 trace_id의 전 구간 재발견(api MDC·judge 로그·Jaeger 스팬 트리), 무효 헤더 방어, 관측 독립성. OTLP gRPC TLS 기본값 함정 명시. 절차 7의 제출은 이제 web에서 Server Action 경유임을 반영.
- 2026-07-28 21:57 — 품질 게이트에 **자동화 테스트**(api 단위13+통합3, judge 8) 추가하고 **CI가 강제**함을 명시. CI가 의도적으로 제외하는 범위(샌드박스 실채점·E2E)도 기록.
- 2026-07-28 21:35 — judge 절차에 **언어 3종·컴파일 에러·미지원 언어** 추가, 러너 이미지 빌드 3종·`go test` 반영. 전 구간 절차에 **실행 모드(run)·케이스별 결과·추적 전파** 확인 항목 추가.
- 2026-07-27 23:13 — 전 구간 절차(7) 신설: api 제출→채점→표시, SSE·멱등성·타임존·번들 발행·채점 불가 확인. api 절차의 필드명을 수치 기준으로 갱신.
- 2026-07-26 20:21 — judge 파이프라인 절차(6) 신설: buf 계약 검사(lint·breaking·generate) + judged/judgeprobe 왕복·캐시·QoS·at-least-once 확인. `head` 파이프 함정 명시.
- 2026-07-26 20:05 — judge 코어 절차(5) 신설: judgecli 판정 5종 + 샌드박스 격리 2종. 인프라 사전 단계에 Kafka·MinIO 추가.

- 2026-07-25 14:07 — api Kotlin 전환([ADR-0007](../decisions/0007-backend-kotlin-return.md)) 반영: contracts 빌드 단계 삭제 → gradle 컴파일·기동 + OpenAPI/계약 정합(gen:api) 단계로 교체.
- 2026-07-25 12:48 — 문서 신설. M1 슬라이스(contracts/api/web) 절차 정리.
