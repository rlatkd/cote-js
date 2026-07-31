# api 아키텍처 (Kotlin + Spring Boot)

- **관련 ADR**: [0007 백엔드 Kotlin 복귀](../decisions/0007-backend-kotlin-return.md) (0005 대체), [0006 서비스 이음새](../decisions/0006-service-seams-and-ai-consolidation.md), [0012 judge 배선](../decisions/0012-api-judge-wiring.md)
- **상태**: Active (2026-07-27 judge 파이프라인 배선 완료)
- **위치**: [`services/api/`](../../services/api/)

## 책임

유저·문제·제출·랭킹 등 플랫폼 비즈니스 로직과 데이터 접근. 실제 코드 채점은 하지 않는다 — 제출을 받아 **Kafka로 judge에 넘기고, 결과를 소비해 저장하고 SSE로 web에 푸시**하는 중심 역할.

## 스택 (적재적소 근거는 ADR-0007)

Kotlin 2.2 · Spring Boot 4.0.x · **WebFlux + 코루틴**(suspend 핸들러) · **R2DBC**(논블로킹 Postgres) · **Flyway**(스키마 이관) · springdoc(OpenAPI) · Gradle Kotlin DSL · JDK 21 LTS

> **스택 선택 근거**: api는 I/O bound 오케스트레이터(DB·Kafka·오브젝트 스토리지)이자 SSE 푸시 주체라 **논블로킹이 도메인 정합**이다 — MVC·JPA·블로킹 스타일을 쓰지 않는 1차 이유가 이것이고, 실무와의 중복 회피(학습 가치)는 그 다음 이유다([ADR-0007](../decisions/0007-backend-kotlin-return.md) 강도 보충 노트).

## Hexagonal 구조

의존 방향: **adapter → application → domain** (domain은 프레임워크 무의존).

```
services/api/src/main/kotlin/com/cotejs/api/
├─ domain/
│  ├─ model/                  Problem·Example·Submission·NewSubmission,
│  │                          Difficulty/Language/JudgeResult(enum+label), ProblemNotFoundException
│  └─ port/
│     ├─ inbound/             ProblemQueries · SubmissionQueries · SubmitCode  (유스케이스 계약)
│     └─ outbound/            ProblemRepository · SubmissionRepository        (영속 계약)
├─ application/               ProblemService · SubmissionService(제출→발행, 결과 반영) · SubmissionEventHub(SSE 팬아웃)
├─ adapter/
│  ├─ inbound/web/            suspend @RestController + DTO(응답 계약) + GlobalErrorHandler(404/400)
│  ├─ inbound/messaging/      JudgeResultConsumer — 결과 토픽 소비 → 멱등 반영 → SSE
│  ├─ outbound/persistence/   R2DBC 엔티티·CoroutineCrudRepository·도메인 매핑(JSONB↔Map, 배열↔List)
│  ├─ outbound/messaging/     KafkaJudgeDispatcher — 제출을 QoS 레인 토픽으로 발행(Protobuf)
│  └─ outbound/storage/       MinioBundleStore — 테스트 번들 발행(claim-check)
├─ src/main/proto-gen/        계약 생성물(Java, 커밋 — 원본은 /contracts)
└─ config/                    CORS · JudgePipelineConfig(Kafka·S3 클라이언트)
```

- **DTO가 JSON 계약의 원본**: 응답 필드명·포맷(submittedAt `"YYYY-MM-DD HH:mm:ss"`, difficulty/language/result는 label 문자열)은 구 contracts와 동일 유지(drop-in). enum은 도메인이 소유하고 DTO 경계에서 label로 직렬화.
- **전역 prefix** `/api`는 `spring.webflux.base-path`.

## API (현행)

| 메서드 | 경로 | 응답 |
|---|---|---|
| GET | `/api/problems` | 문제 목록(id asc, examples 포함) |
| GET | `/api/problems/{id}` | 단건 · 없으면 404 |
| GET | `/api/submissions` | 제출 목록(최신순) |
| POST | `/api/submissions` | 201 생성(**"채점 중"** — 실제 채점은 비동기) · 검증 실패 400 |
| GET | `/api/submissions/stream` | **SSE** — 제출 접수·채점 완료 이벤트 푸시 |
| GET | `/api/v3/api-docs` | OpenAPI 스펙(web codegen 원천) |

## web와의 계약 흐름

```
api DTO → springdoc /v3/api-docs → (web) pnpm gen:api → shared/api/schema.d.ts(커밋)
→ shared/api/contract-check.ts가 도메인 모델과 키 집합·타입 호환을 컴파일 타임 검사
→ 어긋나면 next build 실패 (계약 드리프트 조기 검출)
```

## 채점 파이프라인 배선 ([ADR-0012](../decisions/0012-api-judge-wiring.md))

```
POST /submissions
  → 문제 조회 → 테스트 번들 확보(없으면 test_case로 만들어 MinIO 업로드 후 참조 캐시)
  → "채점 중"으로 저장(즉시 201 응답) → SSE 발행
  → Kafka submission.submit 으로 Protobuf 발행
        … judge 채점 …
submission.result 소비 → 멱등 반영(같은 결과 재수신해도 상태 불변) → SSE 발행
```

- **Kafka 클라이언트를 직접 쓴다**(래퍼 없음): reactor-kafka는 kafka-clients 3.9 기준이라 Boot 4의 4.x와 바이너리 비호환(실측), spring-kafka는 스레드 점유형이라 코루틴 스택과 어긋남. 프로듀서는 콜백을 `suspendCancellableCoroutine`으로 잇고, 컨슈머의 블로킹 `poll()`은 **단일 병렬도 IO 디스패처**에 가둔다(컨슈머는 스레드 안전하지 않다).
- **오프셋은 반영 후 커밋**(at-least-once) — 커밋 후 죽으면 결과가 유실되기 때문. 중복은 `submission_id` 기준 멱등 저장으로 흡수한다.
- **SSE 팬아웃은 인프로세스**(단일 인스턴스 전제). 다중 인스턴스가 되면 Redis pub/sub으로 전환(M2, [ADR-0006](../decisions/0006-service-seams-and-ai-consolidation.md)).

## 데이터

- 스키마·시드는 **Flyway가 소유**(`db/migration/V1__schema.sql`·`V2__numeric_limits_and_judge_fields.sql`, 시드는 `db/seed/R__dev_seed.sql`) — 기동 시 자동 적용. 상세: [data-model.md](data-model.md).
- 함정 기록: Flyway 플레이스홀더가 PG 달러 인용(`$tag${`)을 오인 → `placeholder-replacement: false` 필수.

## 관측 ([ADR-0018](../decisions/0018-observability-tracing.md), 2026-07-30)

- **추적 이어받기**: web(Next 서버)이 보낸 W3C `traceparent`를 제출 컨트롤러가 받아 도메인 `TraceContext.parse()`(외부 입력이라 엄격 검증 — 무효면 버리고 새 추적)로 잇고, `child()`로 구간을 파생해 Kafka 메시지(proto `common.v1.TraceContext`)로 judge까지 전파한다.
- **계측 = OTel Java 에이전트** — `bootRun`에만 부착(`build.gradle.kts`의 `otelAgent` 구성). WebFlux 서버·kafka-clients·R2DBC 자동 스팬 + **logback MDC에 trace_id 자동 주입**. `application.yml` 콘솔 패턴의 `%X{trace_id}`로 **모든 로그 라인이 요청 상관관계 id**를 갖는다. 테스트·CI에는 부착하지 않는다(계측이 결과에 영향 없음).
- **스팬 수신처 = Jaeger**(infra, OTLP HTTP 4318). 에이전트는 메트릭·로그 익스포터를 꺼둔다(백엔드 없음 — 주기적 실패 로그 방지).

## 인증 ([ADR-0019](../decisions/0019-authentication-kakao-oidc.md), 2026-07-31)

- **구조**: Spring Security 미채택 — `AuthenticationFilter`(WebFilter)가 access 쿠키를 검증해 principal을 exchange 속성으로 전파하고, 보호 경계(POST /api/submissions)만 401로 막는다(공개가 기본, 보호가 예외). 컨트롤러도 principal 부재 시 401(이중 방어 — 보호가 필터 경로 매칭 한 줄에만 매달리지 않게).
- **층 배치**: 순수 로직은 `application/auth`(JwtCodec=HS256 자체 세션, IdTokenVerifier=RS256 id_token — 둘 다 JDK 내장 암호 연산, 단위 테스트로 실패 경로 고정) / I/O는 어댑터(`adapter/outbound/oidc/KakaoOidcAdapter` — 코드 교환·JWKS 캐시 6h) / 유스케이스는 `AuthService`(state·nonce를 서명 쿠키로 무상태 운반).
- **쿠키**: 전부 httpOnly·SameSite=Lax. access(1h)=path `/`, refresh(14d, 회전)=path `/api/auth`, oauth_state(10m)=path `/api/auth`. 토큰은 응답 본문에 싣지 않는다.
- **비밀 주입**: `services/api/.env`(gitignore) → bootRun이 환경변수로 로딩(`KAKAO_CLIENT_ID` 등).
- **제출 주체**: body의 user 필드 폐기 — `NewSubmission.by: AuthPrincipal`(non-null)로 "제출=로그인 필수"가 타입 불변식.

## Redis (M2, 2026-07-31 — 역할은 [ADR-0006](../decisions/0006-service-seams-and-ai-consolidation.md) 한정)

- **SSE 팬아웃 = Redis pub/sub** — `SubmissionEventHub`(인터페이스) + `RedisSubmissionEventHub`. 인프로세스 Sinks를 대체한 이유: 다중 인스턴스에서 이벤트가 들어온 인스턴스와 구독자가 붙은 인스턴스가 다를 수 있다. 실패 모드: Redis 다운 시 **알림만** 유실(채점·저장 무관, web은 목록 조회로 복구) — 발행은 로그만 남기고 삼킨다.
- **제출 rate limit** — `RateLimiter` 포트 + Redis 고정 창(INCR+첫 증가에 EXPIRE). run 30/분·submit 10/분(`cotejs.rate-limit.*`), 사용자×모드 키. **fail-open**(한도 장치 장애가 제출을 인질로 잡지 않게). 초과는 429. 고정 창인 이유: 경계 순간 2배 허용이 무해한 워크로드라 슬라이딩 창은 과설계.
- **페이지네이션** — `GET /api/submissions?limit&offset`(기본 50·상한 100). 전량 조회는 계약에서 제거.

## 다음 단계

- **문제 등록 API(admin)** — 지금 번들은 제출 시 lazy 발행이다. 등록 시 발행으로 옮기면 첫 제출이 빨라진다. role=ADMIN 인가는 필터에 경계 추가.
- 랭킹·통계(Redis sorted set)는 M5 리더보드와 함께.
