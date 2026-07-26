# 0009. Judge 착수 설계 — Kafka 직행(M1/M2 통합) + claim-check + Protobuf

- **상태**: Accepted
- **일자**: 2026-07-26
- **관련**: [0006](0006-service-seams-and-ai-consolidation.md)(이음새 전제), [0010](0010-contracts-root-group.md)(`.proto` 거처)

## 맥락

Judge(Go) 착수를 앞두고 로드맵 모순이 드러났다: 구 로드맵은 M1(동기 HTTP 채점)→M2(Kafka 전환)로 나뉘어 있었으나, 이 분할은 **[0006] 이전의 계획**이다. [0006]에서 이음새가 이미 Kafka 기준으로 확정됐으므로(결과토픽·QoS 3레인·judge DB 금지), 동기 채점을 먼저 만들면 "대체가 결정된 구조물"을 짓게 된다. 또한 judge는 DB 접근이 금지인데 채점에 필요한 테스트케이스를 어디서 얻는지가 미정이었고, 폴리글랏 경계(api Kotlin ↔ judge Go)의 IDL도 미선정이었다.

## 결정 1 — Kafka 직행: 구 M1/M2를 통합한다

동기 HTTP 채점 단계를 건너뛰고 처음부터 확정 이음새(Kafka)대로 구현한다.

- **적합성**: 동기 채점은 겉보기에만 단순 — 채점은 수 초 이상 걸려 api의 동기 대기에 타임아웃·재시도·백프레셔 처리가 필요하고, 이는 Kafka 전환 시 전량 폐기된다. 결과 저장 주체도 달라(동기=api가 응답 저장 / 확정안=judge 발행→api 소비) 이음새를 두 번 설계하게 된다.
- **학습**: Kotlin 프로듀서·Go 컨슈머(컨슈머 그룹·오프셋)·레인별 토픽 설계가 이 프로젝트가 Kafka를 채택한 이유 그 자체. 동기 HTTP에서 배울 것은 없다.
- **포트폴리오**: "동기→비동기 전환" 서사는 사용자의 타 프로젝트와 중복. 여기선 "처음부터 이벤트 기반 채점 파이프라인"이 차별화.
- **점진성 확보**: 첫 슬라이스가 커지는 문제는 개발 순서로 푼다 — judge 코어(executor·sandbox)는 전송 무관하게 먼저 검증(테스트/CLI), Kafka 어댑터는 그 뒤에 부착. 동기 단계 없이 같은 점진성을 얻는다.
- **파급**: 로드맵 M1/M2 경계 소멸 → M1=채점 코어(비동기 포함), M2=채점 스케일아웃(워커 수평 확장·SSE Redis 전환)으로 재정의(번호는 유지, 문서 파급 최소화).

## 결정 2 — 테스트케이스 전달 = claim-check 패턴 (MinIO)

테스트 데이터는 오브젝트 스토리지(로컬 개발 = MinIO, S3 호환)에 번들로 저장하고, **제출 메시지에는 참조(오브젝트 키 + 콘텐츠 해시)만** 싣는다. judge는 키로 내려받아 해시 기준 로컬 캐시(동일 문제 재채점 시 다운로드 0회, 해시 변경 = 캐시 자동 무효화).

검토한 대안:

| 대안 | 배제 이유 |
|---|---|
| 메시지에 인라인 | Kafka 메시지 상한(기본 ~1MB)에 대형 입력이 반드시 걸림. 같은 테스트 데이터를 제출마다 반복 운반 — batch 레인(교차검증 대량 실행)에서 낭비 폭발. 인라인 기준으로 IDL을 설계하면 갈아엎게 됨(결정 1과 동일 논리) |
| judge가 api HTTP 조회 | 채점 시점에 judge→api 동기 의존 재도입 — [0006]이 DB 금지로 끊은 결합이 뒷문으로 복귀. 대용량 파일 서빙은 api 본업도 아님 |

- 히든 테스트케이스의 데이터 소유자는 api(코어 스키마 단일 작성자 유지), 번들 업로드도 api가 수행. M3에서 problem이 생성한 테스트 데이터도 같은 번들 규약으로 합류.
- claim-check는 Kafka 생태계에서 대형 페이로드를 다루는 표준 패턴이며, 실제 저지 시스템(DOMjudge 등)도 "참조+로컬 캐시" 방식.

## 결정 3 — IDL = Protobuf (Schema Registry는 도입 보류)

api↔judge Kafka 메시지 계약은 **Protobuf**로 정의한다. 스키마는 레포에서 버전 관리(거처는 [0010]), 각 서비스가 코드젠.

| 후보 | 판단 |
|---|---|
| **Protobuf (채택)** | Go 지원 1급(protoc 생태계 본진), Kotlin/Java·Python 동급 — **judge 경계뿐 아니라 M3의 api↔AI(Python) 경계까지 단일 IDL**로 덮음(추후 gRPC 확장 여지). Schema Registry가 Protobuf도 지원하므로 거버넌스 층은 나중에 추가 가능(배타적 선택 아님) |
| Avro + Schema Registry | Kafka 정석 조합이나 Registry 컨테이너·Confluent 색 짙은 와이어 포맷이 첫 슬라이스 무게를 키움. Go 코드젠도 Protobuf 대비 열세. **학습 축은 "Protobuf+Registry"로 추후 취득 가능** — 재검토 트리거와 함께 보류 |
| JSON Schema | 코드젠·크기·어필 전부 열세 — 탈락 |

## 결정 4 — Kafka 로컬 구성

- **KRaft 단일 노드**(broker+controller 겸직, 복제 계수 1). ZooKeeper는 Kafka 4.0에서 완전 제거 — 신규 구축에 쓸 이유 없음.
- 이미지: **`apache/kafka` 공식**(Confluent·Bitnami 배제 — 전자는 결정 3 방향과 비일관, 후자는 2025 카탈로그 개편). 버전은 안정판 정책대로 **4.1.2**(2026-07 기준 최신 4.3.1에서 두 마이너 뒤, 패치 축적).
- **이중 리스너**: 호스트 네이티브 앱(api·judge)용 `localhost:9092` + 컨테이너 네트워크용 `kafka:29092`(compose 내부 도구·M5 컨테이너화 대비). advertised.listeners 오설정은 도커 Kafka의 대표 함정.
- **토픽 자동 생성 비활성** + compose init 컨테이너로 명시 생성. 암묵 생성은 파티션·보존 설정이 기본값으로 굳는 문제.
- **토픽 체계**: 엔티티 = `submission`(judge 관점의 "실행 요청" — 유저 제출·problem 검증 실행 모두 포함), 레인은 토픽 분리로 QoS 소비 정책 독립.
  - `submission.run` / `submission.submit` / `submission.batch` (api·problem → judge, [0006] 3레인)
  - `submission.result` (judge → api)
- 오브젝트 스토리지: MinIO `RELEASE.2025-09-07T16-13-09Z` 고정, 버킷 `testdata`. 인프라 배치는 기존 패턴(`infra/<서비스>/Dockerfile` + compose build).

## 보류 (착수 시 결정 — 사용자 지정)

다음 3건은 논의에서 추천안까지 나왔으나 **결정은 judge 구현 착수 시점으로 보류**한다(TODO에 추적):

1. **샌드박스 수준**: 추천안 = 1단계 Docker 컨테이너 격리(자원 제한 도커 옵션) 먼저, cgroups/namespaces/seccomp 직접 제어는 별도 마일스톤. 샌드박스는 어댑터로 설계해 교체 가능하게.
2. **첫 슬라이스 언어 범위**: 추천안 = Python 단독(컴파일 단계 없음), executor 인터페이스에는 컴파일 단계 자리 확보.
3. **결과 도달(SSE)**: 추천안 = SSE 포함하되 pub/sub은 인프로세스, Redis 전환은 api 스케일아웃 시점.

Kafka Streams는 현 범위 미적용(모든 구간이 단순 produce/consume — 스트림 변환·조인·집계 없음). 적용 후보(SLA 조인·실시간 통계 등)는 [engineering-notes](../engineering-notes.md)에 기록, 재검토 트리거는 TODO 보류란 참조.

## 파급

- `.proto` 거처 문제 → 루트 `contracts/` 신설([0010], ADR-0008 루트 구성 개정).
- 루트 README 16장 마일스톤 표·9장 처리 흐름, TODO 로드맵, CLAUDE.md 확정 사항 갱신(결정 1 파급).
- 히든 테스트케이스 스키마(DB)·번들 규약은 구현 시 [data-model](../architecture/data-model.md)에 반영.
