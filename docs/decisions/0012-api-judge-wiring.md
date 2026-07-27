# 0012. api↔judge 배선 — JVM 코드젠·Kafka 클라이언트·SSE·테스트케이스 진실원

- **상태**: Accepted
- **일자**: 2026-07-27
- **관련**: [0006](0006-service-seams-and-ai-consolidation.md)(이음새), [0009](0009-judge-kickoff-async-and-contracts.md)(claim-check·Protobuf), [0011](0011-codegen-and-kafka-client.md)(judge 측 코드젠·클라이언트·at-least-once)

## 맥락

judge는 Kafka에서 제출을 받아 채점하고 결과를 발행하는 데까지 완성돼 있었지만, **그 토픽에 제출을 넣고 결과를 받아 저장하는 주체(api)가 없었다** — 개발용 도구(`judgeprobe`)가 대신하고 있었다. api를 배선하며 네 가지를 정해야 했다.

## 결정 1 — JVM Protobuf 코드젠 = buf + protoc 내장 생성기, 생성물 커밋

[0011]에서 Go만 생성하고 JVM은 미결로 남겼던 항목. **Go와 같은 흐름(`cd contracts && buf generate`)을 유지**하고, 산출물은 `services/api/src/main/proto-gen`에 두고 커밋한다(Gradle `sourceSets`로 컴파일에 포함).

- Java 생성기는 독립 플러그인이 아니라 **protoc에 내장**돼 있어 protoc 바이너리가 필요하다(`protoc_builtin: java`). 오픈소스·로컬 실행이라 [0011]의 "외부 SaaS 미사용" 방침과 충돌하지 않는다.
- 대안(Gradle protobuf 플러그인, 빌드 시 생성)을 배제한 이유: 생성 경로가 언어마다 갈라져 "계약 원본 → 생성" 흐름이 둘이 된다. 또 생성물이 커밋되지 않아 **계약 변경이 PR diff에 드러나지 않는다**([0011]에서 커밋을 택한 이유와 동일).
- Kotlin DSL(`--kotlin_out`)은 Java 생성물 위의 빌더 설탕이라 생략했다 — 생성된 Java 클래스는 Kotlin에서 그대로 쓴다.

## 결정 2 — Kafka 클라이언트 = kafka-clients 직접 사용 (reactor-kafka 배제, 실측으로 뒤집힘)

**최초 결정은 reactor-kafka였으나 런타임 검증에서 뒤집혔다.** Spring Boot 4가 관리하는 kafka-clients 4.1과 **바이너리 비호환**이라 첫 메시지에서 죽는다:

```
java.lang.NoSuchMethodError: ConsumerRecord.<init>(..., TimestampType, Long, int, int, ...)
    at reactor.kafka.receiver.ReceiverRecord.<init>
```

reactor-kafka 최신판(1.3.25)도 kafka-clients **3.9** 기준이라 Kafka 4 세대를 따라오지 못한 상태다. 선택지와 판단:

| 대안 | 판단 |
|---|---|
| kafka-clients 3.9로 다운그레이드 | 동작은 하지만 **뒤처진 래퍼를 위해 클라이언트를 낮추는** 셈. 래퍼가 계속 뒤처지면 같은 문제가 반복된다 |
| spring-kafka(`@KafkaListener`) | Kafka 4 지원은 되지만 스레드 점유형 모델이라 코루틴·WebFlux 스택과 어긋난다 |
| **kafka-clients 직접 + 코루틴 (채택)** | 래퍼 의존을 없애 버전 추종 문제 자체를 제거. 자바 프로듀서는 이미 콜백 기반 비동기라 `suspendCancellableCoroutine`으로 감싸면 그대로 suspend가 된다 |

**컨슈머의 진실**: Kafka 자바 컨슈머의 `poll()`은 블로킹이고 스레드 안전하지 않다. 어떤 래퍼를 쓰든 내부는 결국 전용 스레드에서 poll을 돈다. 그래서 우리도 **단일 병렬도로 제한한 IO 디스패처**에 가둔다(`Dispatchers.IO.limitedParallelism(1)`) — 이벤트 루프를 막지 않으면서 컨슈머의 단일 스레드 요구를 지킨다. 래퍼가 감춰주던 것을 직접 다루게 되지만, **감춰진 게 사라지는 것은 아니라는 점**이 이 선택의 교훈이다.

## 결정 3 — SSE 팬아웃 = 인프로세스(임시), Redis 전환은 스케일아웃 시점

제출 접수·채점 완료를 `Sinks.many().multicast()`로 브로드캐스트하고 `/api/submissions/stream`에서 SSE로 내보낸다.

- [0006]은 "SSE 팬아웃 = Redis pub/sub"으로 정했지만 그것은 **api 다중 인스턴스**를 위한 것이다. 현재 단일 인스턴스에서는 인프로세스로 충분하고, Redis를 지금 넣으면 쓰지 않는 능력에 비용을 낸다.
- **임시 상태임을 명시**한다: 인스턴스가 늘면 결과를 소비한 인스턴스에 붙은 구독자만 알림을 받는다 → M2(스케일아웃)에서 Redis 전환(TODO 추적).
- 이벤트는 구독자가 없으면 버린다(`directBestEffort`) — SSE는 **현재 상태 알림이지 이력 저장소가 아니다**. 그래서 web은 ① 목록 조회로 현재 상태를 채우고 ② 스트림은 갱신에만 쓴다(연결 공백 동안의 변화는 새로고침으로 복구).

## 결정 4 — 테스트케이스 진실원 = DB, MinIO 번들은 파생물

히든 테스트케이스는 **`test_case` 테이블이 진실원**이고, judge에 넘기는 MinIO 번들은 그것으로 만든 **파생 캐시**다. `problem.test_bundle_key/sha256`은 그 파생물의 참조.

- 근거: [0006]의 단일 작성자 원칙 — 코어 데이터의 주인은 api다. 번들을 진실원으로 삼으면 데이터가 오브젝트 스토리지로 새어나가 스키마 소유가 흐려진다.
- 발행은 **필요 시 1회(lazy)**: 제출 시 참조가 없으면 만들어 올리고 DB에 캐시한다. 문제 등록 시 즉시 발행하는 방식은 아직 등록 API가 없어 미룬다(M3 problem 파이프라인이 같은 규약으로 합류).
- **패킹은 결정적(deterministic)이어야 한다** — tar 엔트리의 mtime·모드를 고정한다. 안 그러면 같은 케이스인데 압축할 때마다 해시가 달라져 judge의 캐시가 매번 빗나간다(claim-check의 전제가 무너진다).

## 부수 결정

- **판정 `INTERNAL_ERROR`("채점 오류") 도입**: 테스트케이스가 없어 채점 불가한 제출을 오답류로 기록하지 않는다 — 유저 귀책이 아니기 때문(judge 측 규율과 동일).
- **제출 레인 = `submit` 고정**: 지금 web의 "제출"만 실채점이다. "예제 실행"(`run` 레인)은 **공개 예제용 번들 발행 경로가 없어 아직 목업** — 화면에도 그렇게 표기했다(TODO).

## 검증 (2026-07-27 실측)

- **전 구간**: api 제출 → Kafka `submission.submit` → judge 채점 → `submission.result` → api 소비 → DB 반영. 정답(`맞았습니다` 24ms)·오답(`틀렸습니다`) 모두 확인.
- **SSE**: 한 제출에 대해 `채점 중` → `맞았습니다` 두 이벤트가 순서대로 도착.
- **멱등성(at-least-once의 짝)**: 새 컨슈머 그룹으로 **결과 토픽을 처음부터 전량 재소비**시켰을 때 DB가 완전히 동일(13건/정답 7건, `judged_at`까지 불변).
- **타임존 버그(실측으로 발견)**: judge의 UTC 타임스탬프를 그대로 저장해 같은 행의 `submittedAt`/`judgedAt`이 9시간 어긋났다 → 로컬존 변환으로 수정. **부채로 기록**: 애초에 `timestamptz`로 UTC 통일하고 표시에서만 변환하는 게 옳다([data-model](../architecture/data-model.md)).
