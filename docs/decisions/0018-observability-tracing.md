# 0018. 관측성 — 분산 추적(OpenTelemetry)과 로그 상관관계 id

- **상태**: Accepted
- **일자**: 2026-07-30

## 맥락 (Context)

[ADR-0017](0017-published-language.md)로 `common/v1` TraceContext가 api→judge를 로그 필드로 이었지만, 두 구멍이 남아 있었다.

1. **추적이 api에서 시작한다** — 사용자가 겪는 지연의 시작(브라우저 요청)과 로그의 시작이 어긋난다.
2. **로그 필드는 "어디를 지났는가"만 답한다** — "어디서 얼마나 걸렸는가"(구간별 지연·타임라인)는 로그를 사람이 짜맞춰야 한다.

사용자 지시가 결정을 확정했다: *"전체 서비스 로깅 확실히 — 트랜잭션을 찾아갈 수 있는 id"*, OpenTelemetry 도입 진행. 제약: 외부 **호스팅 SaaS 의존 금지**(오픈소스 자가호스팅은 무방 — [ADR-0011](0011-codegen-and-kafka-client.md)의 BSR 배제와 같은 기준).

## 결정 (Decision)

1. **추적 시작점 = Next 서버(web)** — 브라우저가 아니라 신뢰 경계 안에서 W3C `traceparent`를 발급한다. 이를 위해 **제출을 브라우저 직접 fetch에서 Server Action으로 이전**(확정 프론트 아키텍처의 원래 패턴이기도 하다 — [ADR-0004](0004-frontend-architecture.md)).
2. **전파 규약 = W3C Trace Context 단일** — web(fetch 계측)→api(HTTP 헤더)→judge(Kafka 레코드 헤더)→api(결과 헤더). proto의 `common.v1.TraceContext`는 폐기하지 않고 **계약 경로(헤더가 유실돼도 잇는 폴백) + 로그 필드의 원천**으로 유지한다.
3. **계측 방식은 서비스별로 다르게**:
   - **api**: OTel **Java 에이전트**(bootRun에만 부착) — WebFlux·kafka-clients·R2DBC 자동 계측 + **logback MDC에 trace_id 자동 주입**. 콘솔 패턴에 `%X{trace_id}`를 넣어 **모든 로그 라인이 상관관계 id를 갖는다**.
   - **judge**: Go **SDK 수동 계측**(`internal/telemetry` + 채점 1건=스팬 1개) — Go에는 에이전트가 없고, 채점처럼 단위가 굵은 워커는 수동이 오히려 명확하다.
   - **web**: `@vercel/otel`(Next instrumentation hook) — Next 내장 스팬 + fetch 전파(api 오리진을 `propagateContextUrls`에 명시해야 외부 오리진에도 헤더가 실린다).
4. **관측 백엔드 = Jaeger v2 자가호스팅**(compose, OTLP 4317/4318, UI 16686, 저장은 인메모리 — 개발용).
5. **상관관계 id 정책**: 서비스별 reqId를 따로 만들지 않는다 — **W3C trace_id 하나가 전 구간의 reqId**다. 업무 키(`submission_id`)를 함께 찍어 두 축(트랜잭션/제출)으로 검색한다.

## 근거 (Rationale)

- **문제 적합성**: 이 시스템의 요청은 프로세스 경계를 3번 넘는다(HTTP→Kafka→Kafka). 프로세스 안 디버거·단일 로그로는 "어디서 느린가"에 답할 수 없고, 이게 분산 추적이 푸는 문제 그 자체다.
- **학습 가치**: 컨텍스트 전파(HTTP 헤더 vs 메시지 헤더), 에이전트/SDK/프레임워크 계측의 층위 차이, 샘플링·익스포터 구조 — MSA 관측의 핵심 주제를 세 언어로 실습한다.
- **에이전트 vs SDK(api)**: WebFlux+코루틴의 컨텍스트 전파를 손으로 잇는 것은 지금 배우려는 주제(관측)가 아니라 리액티브 배관 작업이고, 에이전트가 이미 해결한 문제다. 반면 judge는 프레임워크가 없어 수동 계측이 곧 학습 지점이다 — **같은 목적, 서비스 성격에 따라 다른 수단**.
- **reqId를 따로 안 만드는 이유**: 서비스별 id는 경계에서 끊긴다. 트랜잭션(제출 1건)이 서비스 4구간을 지나므로, 경계를 넘어 보존되는 id(trace_id)여야 "찾아갈 수" 있다.

## 검토한 대안 (Alternatives)

- **Micrometer Tracing(Spring 표준)**: api만 놓고 보면 Boot 친화적이지만 Go·Node를 못 덮는다 — 폴리글랏에서 벤더 중립 표준은 OTel뿐.
- **Grafana Tempo(+Grafana)**: 백엔드 후보. 저장 확장성은 좋지만 조회 UI(Grafana)까지 한 벌 더 필요하다. 단일 컨테이너에 UI까지 내장한 Jaeger가 개발 단계 적합. **뒤집히는 조건**: 메트릭·로그·추적을 한 화면에 모으는 운영 관측(M5)이 오면 Grafana 스택으로 재검토.
- **Zipkin**: 성숙하지만 OTel 네이티브 통합·활성도에서 Jaeger 열세.
- **SaaS(Datadog·Honeycomb 등)**: 사용자 방침(외부 솔루션 의존 금지)으로 배제.
- **Jaeger 버전**: 최신 2.20.0 대신 **2.19.0** — 최신 첫 릴리스 회피(안정판 정책, Kafka 4.1.2 선택과 같은 기준).

## 결과 (Consequences)

- 이점: 전 구간 로그가 같은 trace_id를 갖고(grep 1회), Jaeger에서 제출 1건이 스팬 트리(HTTP·DB·Kafka·채점 타임라인)로 보인다. 실측: web 지정 trace_id가 api 로그(MDC)·judge 로그·Jaeger 스팬 트리(api 8스팬+judge 1스팬+결과 처리)에서 동일 확인.
- 감수: ① 에이전트는 "마법"이라 계측 원리가 숨는다(judge 수동 계측이 반대편 학습을 보완) ② Jaeger 인메모리 저장이라 재시작하면 추적이 사라진다(개발용으로 충분) ③ web `instrumentationHook`은 Next 14에서 experimental(15에서 정식 — 업그레이드 시 플래그 제거).
- 함정(실증): ① OTLP **gRPC 익스포터의 기본은 TLS** — 평문 Jaeger에 핸드셰이크 실패로 스팬이 조용히 전량 유실된다. 엔드포인트가 https가 아니면 `WithInsecure` ② `@vercel/otel`의 fetch 전파는 기본이 같은 배포 URL 한정 — 별도 오리진(api)은 `propagateContextUrls` 명시 필요 ③ 수동 traceparent 발급과 fetch 계측이 공존하면 로그의 id와 실제 전파된 id가 어긋날 수 있다 — 활성 스팬이 있으면 그 컨텍스트를 쓰도록 통일.
- 후속: OTel 로그·메트릭 파이프라인(지금은 추적만), 샘플링 정책(현재 전량), Jaeger 영속 저장(M5).
