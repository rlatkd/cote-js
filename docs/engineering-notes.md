# 엔지니어링 노트

> 진행 중 고민·질문, 검토한 대안, 해결방안 아이디어, 열린 질문을 기록한다.
> 확정된 결정은 [decisions/](decisions/)(ADR), 지켜야 할 제약 요약은 [/CLAUDE.md](../CLAUDE.md), 할 일은 [TODO.md](TODO.md).

---

## 진행 중 논의 (Deliberation Log)

### Judge 착수 논의 — Kafka 직행·claim-check·Protobuf (2026-07-26) → ✅ [ADR-0009](decisions/0009-judge-kickoff-async-and-contracts.md)·[0010](decisions/0010-contracts-root-group.md)

**계기**: 커밋 완료 후 다음 작업 = Judge 착수. 논의 어젠다 6개를 의존 순서로 정리(① 착수 범위 ② 테스트케이스 전달 ③ IDL ④ 샌드박스·개발환경 ⑤ 언어 범위 ⑥ SSE) — **①~③ 확정, ④~⑥은 사용자 지정으로 착수 시 결정 보류**(추천안은 ADR-0009에 기록).

- **① Kafka 직행**: 구 로드맵 M1(동기)/M2(Kafka) 분할이 ADR-0006(이음새=Kafka 확정) 이전의 계획이라는 모순 발견 → 동기 채점은 "대체가 결정된 구조물"로 판정, 폐지. 점진성은 개발 순서(judge 코어 전송 무관 선검증 → Kafka 어댑터 부착)로 확보. "동기→비동기 전환" 포트폴리오 서사는 사용자 타 프로젝트와 중복이라 가치 없음.
- **② claim-check**: judge DB 금지 상태에서 테스트케이스 조달 문제. 인라인(Kafka 1MB 상한·batch 레인 반복 운반 폭발)·api HTTP 조회(동기 결합 뒷문 재도입) 배제 → MinIO 번들 + 메시지엔 키+sha256, judge 해시 캐시(무효화 내장). 히든 테스트케이스 소유자=api(단일 작성자 유지).
- **③ Protobuf**: Avro+Schema Registry(Kafka 정석이나 Registry 인프라·Confluent 와이어 포맷 무게 + Go 코드젠 열세)와 비교 — **폴리글랏 경계가 judge 하나가 아니라 M3 AI(Python)까지라 단일 IDL의 정합성이 결정타**. Registry는 Protobuf도 지원 → 배타 선택 아님, 보류로.
- **③-부속 → ADR-0010**: `.proto` 거처 문제 — 계약은 서비스 소유물이 아닌데 루트가 3개념(0008)이라 자리가 없음 → 루트 `contracts/` 신설(4개념, 0008 개정). api 안에 두기 배제(결과 스키마는 judge 발행이라 api가 주인일 근거 약함 + Go 빌드가 남의 서비스 폴더 참조). 구 contracts 패키지와의 혼동 주의를 ADR에 명시.
- **Kafka 구성 문답**: KRaft 단일노드(ZK는 4.0에서 제거), apache/kafka 4.1.2(안정판 정책 — 최신 4.3.1 회피), 이중 리스너(호스트 네이티브 앱 localhost:9092 / 내부 kafka:29092 — advertised.listeners 함정), 토픽 명시 생성(자동 생성 비활성).

**Kafka Streams 적용 후보 (사용자 발제 "Streams 필요없나?" → 현 범위 미적용 확정, 후보 브레인스토밍)**:
- 현 범위 미적용 근거: 전 구간이 단순 produce/consume(이벤트 운반) — 스트림 변환·조인·집계 없음. judge는 Go라 Streams(JVM 전용) 불가. 리더보드는 Redis로 기확정.
- **유력 후보**: ① **채점 SLA 모니터링** — 제출↔결과 토픽 stream-stream join으로 채점 소요시간 산출 + "N초 내 결과 없음" 감지(가장 Streams다운 조인 사례, QoS 레인별 지연 증명 시너지) ② **실시간 플랫폼 통계** — 윈도우 집계(분당 제출량·언어 분포·정답률 추이) → admin 대시보드 SSE ③ **콘테스트 실시간 스코어보드**(M5 콘테스트 전제) ④ **이상 패턴 탐지**(답 유출 시그널 등 — Redis rate limit 너머의 윈도우 패턴).
- **탈락 후보**: 정답 필터→plagiarism 전달(필터+라우팅뿐, 일반 컨슈머로 충분), problem 파이프라인 진행 집계(워크플로 상태 주인=problem — 소유권 분열).
- **구조 파급 메모**: 도입 시 api 내장이 아닌 별도 경량 서비스(가칭 `analytics` — 상태 저장 스트림 연산은 다르게 스케일하는 워크로드)가 맞음. 진입점 추천 = ①+②, 시점 = 결과토픽에 실데이터가 흐른 뒤. 재검토 트리거는 TODO 보류란.

### api↔judge 배선 — 승인된 결정이 실측으로 뒤집힌 사례 (2026-07-27) → ✅ [ADR-0012](decisions/0012-api-judge-wiring.md)

**계기**: judge는 완성됐지만 토픽에 제출을 넣고 결과를 받는 주체(api)가 없어 `judgeprobe`가 대신하고 있었다. 사용자 승인 3건(①JVM 코드젠=buf ②Kafka=reactor-kafka ③데이터 모델 부채 지금 상환)으로 착수.

- **순서를 바꾼 이유**: 승인은 ①②③ 순이었지만 **①→③→②**로 진행했다 — 부채(제한값 문자열)를 먼저 갚지 않으면 Kafka 발행 코드에 `"1초"→1000` 임시 파싱이 들어갔다 버려진다. "폐기될 걸 알면서 만들지 않는다"는 앞선 판단(동기 채점 건너뛰기)과 같은 논리.
- **②가 실측으로 뒤집힘**: reactor-kafka는 컴파일은 되는데 첫 메시지에서 `NoSuchMethodError`(ConsumerRecord 생성자). 조사 결과 **reactor-kafka 최신(1.3.25)도 kafka-clients 3.9 기준**이고 Boot 4는 4.1을 가져온다. 선택지 ① 클라이언트 3.9 다운그레이드 ② spring-kafka(블로킹) ③ kafka-clients 직접. ③ 채택 — ①은 **뒤처진 래퍼를 위해 본체를 낮추는 역전**이라 같은 문제가 반복된다. 직접 써보니 드러난 사실: 컨슈머 `poll()`은 원래 블로킹·스레드 비안전이라 어떤 래퍼도 전용 스레드에 가둘 뿐이다(우리는 `limitedParallelism(1)`). 반면 프로듀서는 원래 콜백 비동기라 코루틴으로 감싸면 진짜 suspend가 된다.
- **테스트케이스 진실원 논쟁**: 번들(MinIO)을 진실원 삼으면 코어 데이터가 스토리지로 새어나가 단일 작성자 원칙이 깨진다 → **DB `test_case`가 진실원, 번들은 파생 캐시**. 발행은 제출 시 lazy(등록 API가 아직 없어서). 파생물 규율 둘: 결정적 패킹(tar mtime·모드 고정 — 안 그러면 해시가 매번 달라져 judge 캐시가 100% 빗나감), 참조는 캐시일 뿐(지우면 다시 만들면 됨).
- **SSE 범위**: [0006]의 "팬아웃=Redis"는 다중 인스턴스용이므로 지금은 인프로세스. **임시 상태임을 ADR·TODO에 명시**(원칙 4). 이벤트는 구독자 없으면 버린다 — SSE는 알림이지 이력이 아니므로 web은 "목록으로 현재 상태 + 스트림으로 갱신" 조합.
- **실측으로 발견한 버그 2건**: ① `@Bean` 팩토리 메서드명이 컴포넌트 클래스명과 충돌해 기동 실패 ② **타임존 9시간 어긋남**(judge=UTC 발행, api=로컬 저장). 후자는 경계 규약 부재의 전형 — 각 서비스는 내부적으로 일관됐고 경계에서만 깨졌다. 임시로 로컬 변환하고 근본(`timestamptz` UTC 통일)은 부채 등록.
- **스택 원칙 완화(사용자 문답)**: "실무 재탕 금지는 언제 명시했나, 기술적으로 옳으면 실무 것도 쓸 수 있다"는 질문에 출처를 확인 → **ADR-0007에서 Claude가 규칙화한 문구**이지 사용자 지시가 아니었다. 의도보다 경직됐던 것을 완화(적합성 우선). **기존 결정은 하나도 뒤집히지 않았다** — WebFlux·R2DBC·직접 Kafka 모두 실무 회피가 아니라 독립적 기술 근거(I/O 지배 워크로드·스택 일관성)로 서 있었기 때문. 이 확인 자체가 "근거를 결론과 함께 남긴" 덕에 가능했다.

### judge 어댑터(Kafka·MinIO) — 도구 선정과 전달 보장 (2026-07-26) → ✅ [ADR-0011](decisions/0011-codegen-and-kafka-client.md)

**계기**: 채점 코어를 파이프라인에 연결. 세 결정이 함께 필요했다(코드젠 도구 / Kafka 클라이언트 / 전달 보장).

- **코드젠 — 사용자 지적으로 추천이 뒤집힌 사례**: 최초 추천은 buf **원격 플러그인**(로컬 설치 불필요)이었는데, 사용자가 "외부 솔루션 의존은 문제 아닌가(오픈소스는 제외)"를 제기 → 확인해보니 buf는 **CLI=오픈소스(Apache 2.0) / BSR=Buf사 호스팅 SaaS**로 층이 나뉘고, 원격 플러그인만 SaaS에 걸려 있었다. 내가 편의(플러그인 설치 생략) 하나를 위해 외부 의존을 끌어들이면서 그 트레이드오프를 한 줄로만 언급한 게 부실했음. → **buf CLI + 로컬 플러그인**으로 수정(전 구성 오픈소스·로컬). 남은 이득은 그대로: 선언적 설정, lint, 그리고 **`buf breaking`이 Schema Registry 보류로 생긴 호환성 강제 공백을 메꿈**.
- **Kafka 클라이언트**: 결정 기준은 성능이 아니라 **cgo 여부**(confluent-kafka-go는 librdkafka 바인딩 → Windows 네이티브 개발과 마찰, "인프라만 도커" 원칙과 궁합 나쁨)와 **프로토콜 완전성**(추후 트랜잭션·관리 API에서 클라이언트를 갈아타지 않도록). → franz-go(순수 Go·커버리지 최대). sarama는 리밸런스 함정·유지보수 약화, segmentio/kafka-go는 커버리지 부족으로 배제.
- **전달 보장**: 자동 커밋(=사실상 at-most-once 위험)을 끄고 **채점 후 수동 커밋 → at-least-once**. 근거는 실패의 비대칭 — **유실은 사용자 화면이 영구히 "채점 중"에 머무는 눈에 보이는 실패**, 중복은 채점이 순수 함수에 가까워 무해. exactly-once는 부수효과가 외부(Docker 실행)라 트랜잭션이 못 되돌려서 배제. 대신 소비자 멱등(api, `submission_id`)이 세트로 필요 — 미구현이므로 다음 슬라이스 필수 항목으로 기록.
- **QoS 구현 방식**: 레인별 전용 워커 풀(자원 낭비) 대신 **폴 배치 내 안정 정렬**. 한계를 문서에 명시 — 선점이 아니라 폴 단위 우선순위(집어 든 batch가 끝나야 새 run 실행). 엄밀한 선점은 레인별 동시성 슬롯(M2).
- **작은 판단들**: poison message는 건너뜀(무한 재시도로 파티션 막힘 방지) / 시스템 장애도 `INTERNAL_ERROR` **결과를 발행**(침묵이 최악) / 결과 토픽 키=`submission_id`(같은 제출 순서 보장) / 번들 캐시는 **콘텐츠 해시 키 + `.complete` 마커 + staging→rename**(반쪽 캐시·무효화 문제 동시 해결) / 해시 불일치는 채점 거부 / tar 해제 시 zip slip·심볼릭 링크 방어.
- **검증 함정(실증)**: 백그라운드 워커를 `| head -8`로 파이프했더니 **head 버퍼가 로그를 삼켜** 메시지를 소비했는데도 조용했다 — 처리 순서 검증을 오판할 뻔. 파이프 없이 재실행해 레인 우선순위(run→submit→batch→batch)를 확인.

### judge 1차 슬라이스 구현 — 설계 판단 로그 (2026-07-26)

보류 3건이 확정(샌드박스=Docker 격리 / 언어=Python 단독 / SSE 포함)되며 코어 구현. **구현 중 실제로 갈렸던 판단들**을 남긴다(상세 근거는 [architecture/judge.md](architecture/judge.md), 일반화된 교훈은 [learning-notes](learning-notes.md)):

- **포트 경계를 어디에 그을까**: 후보 ① 언어별 executor ② 샌드박스만 어댑터. ②채택 — 이 프로젝트에서 확실히 바뀌는 건 **격리 방식**(1→2단계)이고 채점 절차는 불변이므로, 경계는 "개념이 다른 곳"이 아니라 **변화 속도가 다른 곳**에 그어야 한다. ①이었다면 언어 추가마다 절차가 복제됐을 것.
- **컨테이너 수명**: 케이스당 컨테이너(격리 깨끗, 기동비용×N) vs 컨테이너 1개+케이스별 프로세스. 후자 채택 — 위협 모델상 격리가 필요한 경계는 **제출↔호스트**이지 케이스끼리가 아니다(제출 1건은 코드가 하나).
- **메모리 한도 이중화**: `--memory`만 걸면 OOM killer가 harness를 죽여 유저의 MLE가 INTERNAL_ERROR로 둔갑할 수 있음을 발견 → 정밀 한도는 제출 프로세스에 `RLIMIT_AS`, 컨테이너는 +64MB backstop. "한도를 건다 = 초과 시 **누가 죽는지**를 정한다".
- **`exec.CommandContext` 함정(실증)**: 컨텍스트 만료는 docker CLI만 죽이고 컨테이너는 생존 → 이름 붙여 `docker kill` 명시 호출. 클라이언트-데몬 모델의 일반 함정.
- **판정 책임 분리**: harness는 사실(exit code·timeout·시간·메모리)만 보고, Verdict 번역은 executor. 언어 확장 시 정책이 흩어지지 않게. 우선순위 TLE>MLE>RE>AC/WA(시간초과 프로세스는 exit code도 비정상이라 순서가 중요).
- **error vs Verdict 규율**: Go `error`는 시스템 장애 전용, 유저 귀책은 Verdict. `Compile()`이 컴파일 실패에 error를 반환하지 않는 것은 이 규율의 시그니처 표현.
- **출력 비교 관대함의 정도**: byte-exact(개행 하나로 오답) ↔ 전체 공백 무시(형식 있는 문제에서 거짓 정답) 사이에서 표준 관행(CRLF 정규화+줄별 후행공백 제거+말미 빈줄 무시) 채택.
- **첫 실패 후 중단 여부**: 대회형(중단)이 아닌 **전 케이스 실행** 채택 — 학습 플랫폼의 가치("몇 번에서 틀렸나") + batch 레인의 검증 신호.
- **러너 이미지 소유권**: infra가 아닌 judge — 인터프리터 버전이 판정을 바꾸므로 채점의 일부.
- **실증된 한계(문서화)**: `getrusage` 메모리는 케이스 간 단조 증가(케이스별 피크 아님), MLE 식별이 `MemoryError` 문자열 의존(언어 중립 아님), `--network none`에서 외부 접속은 즉시 실패가 아니라 **DNS 대기 → TLE로 관측**. 셋 다 2단계(cgroup 직접 제어)에서 해소 예정.

### 서비스 네이밍 대장정 — 은유 → 기능명 → 2층 체계 (2026-07-25) → ✅ [ADR-0008](decisions/0008-service-naming-and-group.md)

**계기**: 사용자 "이름들부터 다시 정하자". 경위가 교훈적이라 상세 기록:

1. **은유의 해체**: 사용자 지적 "arena·hub는 그냥 frontend/backend 아닌가?" → 정확. judge·setter는 도메인 동사(전문가)라 역할명이 성립하지만, front/back은 **다역할 범용 표면**이라 역할명을 붙이면 코스프레가 됨. "역할이 드러나는 이름" 원칙을 전문가/범용에 일괄 적용한 게 무리수였음.
2. **기능명(-er) 통일 시도와 실패**: web/api/grader/generator/matcher → author… 로 가던 중 사용자가 결함 발견 — **상위 이름이 하위 일부만 대표**(generator↛validation, embedding↛search). 행위자 체계의 구조적 한계.
3. **2층 체계(사용자 제안, 채택)**: 상위=책임 영역(judge·problem·plagiarism), 하위=처리 단계(generation·validation·workflow / embedding·retrieval·scoring). 상위·하위가 다른 질문에 답해서 포괄 문제가 구조적으로 소멸. judge도 이 체계에선 정합(업계 표준어).
4. **그룹명**: 사용자 질문 "platform도 옳은가?" → 내용물 직설 원칙으로 `services`(루트 = services/infra/docs 평행).
5. 기각 기록: evaluator(=eval() 연상), producer(Kafka producer 충돌), grader/matcher/author(-er 체계와 함께).

**부수 확정**: ① ADR 운영 규칙 — 개정 시 원문 동결+새 ADR(사용자 지적 "지우면 히스토리를 모른다"에서 옴. 문서 독자는 git log를 안 뒤진다) ② 인프라도 서비스별 Dockerfile(`infra/postgres/`— 사용자 지시를 "관행"으로 덮었던 것 시정, pgvector 확장 자리 겸용) ③ 시드 A안 — V2 시드를 `R__dev_seed`(Repeatable·멱등)로 분리, 프로파일로 운영 차단. "스키마는 api(앱) 소유가 맞나?" 논의 포함 — 앱 소유가 현대 표준(스키마·코드 동시 변경, 서비스별 소유권), DB 소유는 공유 DB+DBA 시대 모델.

**실행**: `git mv` 3건(platform→services, arena→web, hub→api), Kotlin 패키지 개명, web fetch 헬퍼 `client.ts`(apiGet, API_URL). **함정 실증**: 일괄 sed가 적용된 Flyway V1 주석까지 건드려 체크섬 불일치로 기동 실패 → 원복(적용된 마이그레이션은 불변). 전 검증 그린.

### 전체 서비스 구성 리뷰 — 이음새 6규칙 + AI 3→2 병합 (2026-07-25) → ✅ [ADR-0006](decisions/0006-service-seams-and-ai-consolidation.md)

**계기**: 백엔드 착수 전 "전체 구성에 개선할 부분이 없나" 리뷰. 결론: **서비스 목록은 건강, 구멍은 전부 서비스 "사이"(이음새)에 있었다.**

**적재적소 재확인(심문 기록)**:
- **judge=Go 심문**: 워크로드 = 워커 층(동시성·타임아웃·취소) + 샌드박스 층(cgroups·namespaces·seccomp 시스템콜). goroutine+context가 워커 층의 정답이고, 컨테이너 생태계(runc/Docker/K8s/gVisor)가 전부 Go라 격리 레퍼런스를 그대로 읽을 수 있음. 대안 기각: Rust(기술 동급이나 이 도메인은 메모리 곡예가 없어 강점이 안 팔림+생태계 시너지 열세), C/C++(내부 샌드박스 툴 층 얘기, 워커까지 C일 이유 없음), Python(GIL·배포·측정부 결국 C), **JVM(가장 명백한 부적합** — 워밍업·메모리·fork/exec 궁합·JNI), Node(네이티브 애드온 의존). GC 우려는 측정 대상이 자식 프로세스(커널이 잼)라 무효.
- **백엔드 재론**: 이 세션에서 "구현은 Claude가 하니 VSCode DX 무관 → Kotlin 복귀" 논의가 있었으나, 병렬 세션에서 [ADR-0005](decisions/0005-backend-language-and-type-sharing.md)(NestJS, 실무 Java+Spring과의 차별화가 결정타)가 이미 확정·구현됨 → 그에 따름.
- **AI 3→2**: setter(생성)와 tester(검증)는 항상 붙어 도는 한 파이프라인 + 둘 다 경량 I/O 오케스트레이션 → 네트워크 경계 실익 없음, "전시용 분해"로 판정. **scout만 임베딩 모델 상주 서빙이라 자원 특성이 달라 독립 유지.** 경계 원칙: "설명하기 좋은 곳"이 아니라 "다르게 스케일하는 곳". tester는 setter 내부 모듈명으로 강등(실제 CP에서 setter가 출제+검증 겸임이라 명칭 정합). 부하 급증 시 재분리 여지(모듈 경계 유지).

**이음새 6구멍 → 6규칙** (상세는 ADR-0006): ① 채점 결과 실시간 경로 부재 → judge→Kafka 결과토픽→hub→SSE ② DB 소유권 규칙 부재 → 스키마당 단일 작성자(judge는 DB 금지) ③ 실행 요청 3등급(run/submit/batch)이 한 큐에 뭉개짐 → QoS 레인 분리 ④ 오프라인 파이프라인 지휘자 부재 → setter 소유 상태머신 ⑤ 검수 게이트 UI 계획 부재 → arena admin+hub admin(M3) ⑥ Redis "캐시" 모호 → rate limit·리더보드·pub/sub.

**오버엔지니어링 방어선(배제)**: API Gateway 서비스(hub가 단일 진입점), Airflow(파이프라인 1개), WebSocket(단방향 알림엔 SSE), 마이크로서비스 추가 세분화.

### 백엔드 재선정 + 프론트·백 타입 공유 + 서비스 네이밍 (2026-07-11) → ✅ [ADR-0005](decisions/0005-backend-language-and-type-sharing.md), [ADR-0003](decisions/0003-monorepo-structure.md) 갱신

**계기**: 백엔드 착수 시점에 [ADR-0001]의 Kotlin+Spring을 재검토. 사용자 제기: "VSCode에서 작업하기 좋은 NestJS나 Go 등"으로 대체 가능한가.

**핵심 진단**: 사용자 실무가 **Java+Spring**이라 Kotlin+Spring은 언어만 다르고 패러다임·생태계 동일 → **학습 신규성·포트폴리오 차별화 최저**. 프로젝트 목표(넓은 신규 학습)와 충돌. + Kotlin VSCode 지원은 2025년 JetBrains 공식 LSP가 나왔으나 아직 초기라 TS/Go/Rust 툴링에 못 미침(웹검색 확인). → 사용자의 Kotlin 의심이 타당.

**"언어로 묶기" 축 (사용자 통찰)**: 백엔드는 언어 하나라, 어느 이웃과 묶느냐의 선택.
- **짝 A** = 프론트(arena)+백(hub) 같은 TS → `contracts`로 타입 공유. 코딩테스트는 제품이라 이 경계가 가장 자주 바뀜 → 이득 매일 발생.
- **짝 B** = 백+judge 같은 Go → Kafka 계약 공유. but 무거운 비즈니스 도메인엔 Go 적합성 약함 + Go 2개.
- 결론: **짝 A 채택**. 폴리글랏 경계(hub↔judge/AI)는 같은 언어로 못 묶으니 IDL(Protobuf/OpenAPI)로.

**JS 백엔드 후보**: NestJS(구조·DI·Spring 지식 전이) / AdonisJS(신규성 최대) / Fastify(자체 레이어드 일관) / Hono·Elysia(경량) 비교. → **NestJS**(전이+성숙도). ORM은 **Prisma**(타입세이프, 짝 A 테마 일관; TypeORM은 JPA 전이 크나 배제).

**폴더 구조 논의**: 초기 제안(루트=JS 워크스페이스 + `packages/contracts`)을 사용자가 반려 — "루트를 통째로 JS 워크스페이스로 만들지 말고 계층을 하나 더 둬서 공유". → **`platform/` 그룹**(TS 워크스페이스)을 루트 밑에 두고 arena·hub·contracts 격리. Go/Python은 루트 직속. 교훈: 폴리글랏 루트에 JS 도구를 얹지 않는다.

**서비스 네이밍**: 사용자 제기 "frontend/backend는 진부, judge처럼 역할이 드러나는 명칭". → 경쟁 프로그래밍 **실제 도메인 용어**로 통일: `arena`(경기장)·`hub`(중심)·`judge`(채점)·`setter`(출제)·`scout`(중복 정찰)·`tester`(검증). 파이프라인이 폴더명으로 읽힘. 트레이드오프(초견 인지비용)는 glossary·README 서비스맵으로 해소. 교훈: 억지 작명이 아니라 도메인 authentic 용어라 방어 가능.

**구현 결과(검증됨)**: `contracts` 빌드 → hub(Prisma+Postgres, seed 7문제·10제출) → GET/POST(zod)/404/400 curl 통과 → arena `next build` + 실런타임 렌더(hub 데이터가 HTML 반영, 5라우트 200). 실제 채점은 stub("채점 중")로 남기고 Judge(Go) 마일스톤으로 이월.

**남은 것**: 인증/인가, 데이터 모델 수치화(ms·MB), 페이지네이션, hub→judge Kafka 계약(IDL).

### 디자인 시스템 — LLM median UI 탈출 (2026-07-11) → ✅ 1차 도입 ([architecture/web-design-system.md](architecture/web-design-system.md))

**문제 제기**: LLM으로 만든 POC UI는 어떤 모델이든 같은 인상(다크 미니멀, 테두리 둥근 박스 반복, 제네릭 블루, 시스템 폰트)으로 수렴한다. "이게 실제 괜찮은 건가, 아니면 초보 티인가?"

**진단(결론)**: 스타일 자체(모던 다크 미니멀)는 프로 언어이며 죄가 없다. 초보 티는 **실행 디테일**에서 난다. 5축으로 현 프론트를 진단:

| 축 | 진단 | 판정 |
|---|---|---|
| 간격 시스템 | Tailwind 스케일 일관, `px-4 py-3` 리듬 통일 | 🟢 강점 |
| 타이포 위계 | **body 서체 미정의(시스템 기본) → 정체성 0**, 타입 스케일 부재 | 🟡 median |
| 색 절제 | 무채색+brand 하나로 절제 우수. 단 brand `#4f7cff` = 제네릭 SaaS 블루 정중앙 | 🟢 강점/함정 |
| 상태·디테일 | hover/disabled/loading은 있음. **focus-visible 실종(키보드 탐색 안 보임)**, 빈 상태 불균형 | 🟡 median |
| 여백 | 넉넉·의도적 | 🟢 강점 |

**"LLM 티"의 핵심 3요인**: ① 모든 표면이 동일한 `border+rounded` 박스 ② `Sparkles`=AI 클리셰 남용 ③ 정체성 서체 부재 + 제네릭 블루.

**결정 & 배제 이유**:
- **서체**: Pretendard(UI) + JetBrains Mono(코드). Pretendard는 한글+라틴 동시 대응이라 한국어 개발 도구에 적합. Geist(Vercel)는 "그 템플릿 폰트"라 배제, Inter는 median이라 배제.
- **브랜드 색**: `#4f7cff` → 딥 코발트 `#3d5afe`(다크 `#5573ff`). 색 선택 시 제약이 좁았다 — **보라/바이올렛 = AI 제품 클리셰(우리가 AI 제품이라 역효과)라 배제**, 초록 = pass, 빨강/핑크 = fail, 앰버/옐로 = 티어, 틸 = pass(초록)와 혼동 위험이라 배제. 결국 "제네릭 블루가 아닌, 의도적으로 깊고 전기적인 코발트"로 착지. 정체성은 색보다 서체·표면·디테일이 만든다고 판단(색 exotic화는 "적합성" 리스크).
- **토큰 시스템**: 색을 CSS 변수 단일 진실원으로 이전(`bg/surface/elevated/border/fg/muted/faint/brand`). `<alpha-value>` 채널 방식으로 투명도 유틸 유지. `dark:` 이중 표기 제거 + 표면 3단계 위계로 박스 단조로움 해소. (포트폴리오: "체계적 설계" 신호.)
- **디테일**: 전역 `:focus-visible` 링, 빈 상태 3곳 보강, `tabular-nums` 수치 정렬, 시그니처(활성 탭 인디케이터·brand 도트 ping·`--ease-soft` 공통 이징).
- **AiBadge** 컴포넌트로 AI 표식 통일(반짝이 제거 + 중복 마크업 제거).

**남은 것(향후)**: 실제 브라우저 스크린샷 기반 before/after 비교 미수행(헤드리스 HTTP 검증만). 도메인 특화 시그니처(코테다운 모션·정보밀도) 추가 여지. brand 색은 단일 변수라 언제든 교체 가능.

#### 후속 — 보수적 폴리시 → 하드 재개편 "Instrument" (2026-07-11)

**전환 계기**: 위 1차 도입은 **시각적으로 너무 보수적**이었다. 토큰 팔레트를 기존 zinc와 거의 같은 값으로, 브랜드도 파랑→파랑(#4f7cff→#3d5afe)으로 잡아서 **사용자가 "뭐가 바뀐 거냐"고 못 느낌**. 교훈: 토큰·서체·a11y 같은 *구조* 개선은 median 탈출에 필요조건이지 충분조건이 아니다. **비주얼은 과감한 결정을 안 하면 안 바뀐다.** ("median 탈출엔 취향 결정이 필요하다"고 말해놓고 정작 안 함 = 자기모순이었음.)

**재정의**: 사용자가 "하드해도 좋으니 전문성 있게 재개편" 요청 → **강한 컨셉 우선**으로 전환. 컨셉 = **"Instrument"**(정밀 계기). 4기둥: 모노 구조 언어 / 각진 기하 / 시그널 앰버 / 계기형 배지. 상세는 [architecture/web-design-system.md](architecture/web-design-system.md).

**액센트 색 결정 과정**: 후보를 말로 고르지 않고 **임시 토글 위젯**(`data-accent` 속성 스위칭, `[TEMP]` 마킹으로 격리)을 만들어 **앰버/시안/라임/코발트를 실시간 비교**. 사용자가 직접 눈으로 보고 **앰버 확정**. → 교훈: 색 같은 취향 사안은 논쟁하지 말고 **비교 가능한 도구를 쥐여주는 게 빠르다.** 확정 후 토글 3지점(컴포넌트·CSS 블록·layout 마운트) 제거.

**결정 근거(앰버)**: 개발자 도구는 죄다 파랑·보라·초록 → 따뜻한 액센트가 희소해 기억에 남음(차별화). CRT 터미널 앰버 계보 = "Instrument" 컨셉과 논리적 연결. 근-검정 위 발광. 성공(초록)/실패(빨강)와 안 부딪힘. 트레이드오프(따뜻함이 근엄함을 살짝 깎음, 라이트모드 가독 약함)는 인지하되 다크우선이라 수용.

**적용 범위(완료)**: 디자인 시스템 전면 교체(순수 뉴트럴 캔버스·각진 borderRadius 스케일·brand-ink 토큰·mono-label·grid-texture·blink) + 5개 화면 전부(홈 계기판, 목록/현황 계기 테이블, 문제풀이 split view, 네비 터미널 워드마크) + 배지(도트+모노). `next build` 통과, 5라우트 200.

#### 후속 — 기본 테마 다크→라이트 전환 (2026-07-11)

**계기**: 사용자가 라이트 모드를 선호("일반 모드가 좋다", 주황 액센트는 유지). 기본이 다크로 박혀 있는 걸 별로라고 판단.

**결정**: 기본 테마를 **라이트로 전환**(다크는 토글 유지). [layout.tsx](../../platform/arena/app/layout.tsx) themeScript를 `localStorage.theme==='dark'`일 때만 다크로 반전, [ThemeToggle](../../platform/arena/shared/ui/ThemeToggle.tsx) 초기값 `false`.

**라이트 보정**: 라이트 팔레트가 `bg`·`surface` 모두 순백(255)이라 패널이 배경과 안 갈라지는 문제 → `bg`를 미세 그레이(250)로 낮춰 흰 surface가 뜨고 그레이 elevated(244)가 가라앉는 **3단 위계**를 라이트에도 확보. `muted`/`faint`/`brand` 대비도 소폭 보강.

**메모**: 앰버 액센트는 원래 다크에서 먼저 설계됐고(엔지니어링 노트 상단 '앰버 결정' 참고, "라이트 가독 약함"을 트레이드오프로 인지) 다크 우선으로 문서화됐었다. 이번에 기본을 라이트로 뒤집으며 ADR-0002·CLAUDE.md·디자인시스템 문서의 '다크 기본/다크 우선' 표기를 정정. 팔레트 자체는 양 모드 모두 유지.

### 프론트엔드 코드 아키텍처 — ✅ 결정됨: (C) 자체 도메인 레이어드 ([ADR-0004](decisions/0004-frontend-architecture.md) Accepted)

> 아래는 결정에 이른 논의 기록(히스토리).

- **맥락**: 스택·POC 디자인 확정 후 프론트 코드 아키텍처를 선정하는 중.
- **경위**:
  1. MVC / Hexagonal / FSD 등 정형 패턴 검토 시작.
  2. FSD → 사용자 제외.
  3. Hexagonal(프론트 적용) → "백엔드 냄새"라며 반려.
  4. 프론트 네이티브 후보 정리: Bulletproof React(feature-based), MVVM(훅=ViewModel), 상태 분리(TanStack Query + Zustand), Atomic(UI 한정).
  5. 사용자 정정: "네카라쿠배당토"는 예시일 뿐, 요지는 "FSD처럼 정형화된 트렌디한 named 아키텍처가 또 있냐".
  6. Claude 답: 그 조건(정형화 + 프론트 네이티브 + 폴더 레벨 + 트렌디)을 다 만족하는 FSD 경쟁자는 드묾. 직접 대안은 Bulletproof React 정도, Atomic은 UI 한정, MVVM 등은 층위가 다름.
  7. 사용자 제기: "이건 Next.js니까 Next.js에 최적화된 아키텍처로 가야 하지 않나" → Claude 동의.
- **현재 유력안**: **Next 네이티브 = RSC 서버우선 + feature-based 모듈 + thin `app/` 라우팅.**
  - 근거: Next.js App Router는 자체 아키텍처 모델(RSC / 서버·클라 경계 / Server Actions / layout)을 가짐. FSD·Bulletproof React 등은 SPA 시대 산물이지만, **FSD는 공식 App Router 가이드로 Next에 적응함**(아래 리서치). 따라서 "Next라 FSD 불가"는 성립하지 않음 — 선택은 '프레임워크 밀착(경량 feature-based)' vs '정형화(FSD)' 취향 문제로 좁혀짐. Next 공식 "Project Organization" 관례가 사실상 표준.
  - 구조안: `app/` = 라우팅·layout·loading/error·server action만 / `features/*` = 도메인 모듈(컴포넌트·훅·api 콜로케이트) / `components/ui` = 프레젠테이셔널 공용 / `lib/` = api 클라이언트·유틸.
  - RSC 기본, Monaco 통합 화면 등 인터랙션은 **client island**. MVVM(훅=ViewModel) 병행.
  - **다음 결정**: 아래 리서치 반영해 (A) 경량 feature-based+RSC / (B) FSD-on-Next 중 재선택 → 확정 시 [ADR-0004](decisions/0004-frontend-architecture.md)를 Accepted로 전환하고 `frontend/` 내부 재배치.

### 리서치 — 실무/글로벌 기업 프론트 아키텍처 (2026-07-09)

- **기업은 스택은 공개해도 코드 아키텍처는 거의 공개 안 함.** Next.js 프로덕션 사용사(Netflix·TikTok·Uber·Nike·Starbucks·OpenAI·Stripe·Notion·Linear·Hulu 등)는 렌더링 전략(SSG/ISR/SSR)·사용 표면만 공개, named 코드 아키텍처는 대부분 비공개. → "대기업이 채택한 아키텍처를 그대로 베낀다"는 성립 어려움.
- **코테 운영사(LeetCode/프로그래머스/Codeforces/AtCoder)**: 프론트 아키텍처 신뢰할 만한 공개 자료 없음. Codeforces·AtCoder는 구형 서버렌더(Next 아님). 참고할 "코테 표준"은 없음.
- **문서화되어 수렴하는 사실**: ① 렌더링 = RSC + SSG/ISR/SSR + server/client 경계(모든 Next 프로덕션 공통). ② 코드 조직 = feature-based(folder-by-feature)가 지배적. ③ FSD = 정형 방법론, 은행/핀테크/이커머스 채택 증가 + **공식 Next App Router 가이드 존재**(`app/`=라우팅, `src/`=FSD 레이어). ④ 토스 = Turborepo 모노레포 + 관심사 분리.
- **정정 (Claude 오류)**: 이전에 "FSD는 Next와 이름 충돌로 부적합"이라 한 것은 오류. FSD 공식 가이드가 충돌을 해결함(`app/` 라우팅 + `src/` 레이어). FSD는 Next 프로덕션에서 사용됨. 단 소규모엔 무겁다는 평은 유효.
- **좁혀진 실질 후보(둘 다 프로덕션·트렌디)**: (A) 경량 feature-based + RSC(Next 네이티브) / (B) FSD-on-Next(정형·명시). 차이는 '형식·규칙 강제 수준' 하나. → 사용자 재선택 대기.
- 출처: [FSD Next 가이드](https://feature-sliced.design/blog/nextjs-app-router-guide), [Next 사용 기업](https://github.com/vercel/next.js/discussions/10640), [대규모 Next 아키텍처](https://www.freecodecamp.org/news/reusable-architecture-for-large-nextjs-applications/), [토스 프론트 챕터](https://toss.tech/article/toss-frontend-chapter).

### 리서치 2 — 기업 엔지니어링 블로그 실제 사례 (2026-07-09)

| 기업 | 실제 채택 | 핵심 |
|---|---|---|
| 배민(우아한형제들) | 자체 4레이어 `Web-Service ← Bridge(훅) ← Data(react-query·store·API) ← Model`, 단방향 의존, 디자인시스템 별개 | named 패턴 안 베끼고 도메인 맞춤 자체 정의 + Bad/Good 내부 가이드. v0→v2 반복 |
| Money Forward | entities 도메인 레이어(View / ViewModel=`entities/*/index.ts` / Repository=`mapper.ts` / DataSource) + RSC + Server Actions | 비즈로직 서버 이전, progressive enhancement, Feature Flag 4단계 점진 마이그레이션 |
| Artsy | App Router/RSC 도입 시도 후 **철회**, Pages Router 유지 | RSC/`use client` 경계 지옥(클라 코드가 RSC 경계 만나면 전체 실패), DX·단순함 > RSC 성능 |
| Airbnb/Shopify | 모노레포 + 의존성 버전 통일 + 업그레이드 자동화 | 대형사 "아키텍처"의 방점은 모노레포 운영·의존성 전략 |
| 카카오엔터 | Next Full Route Cache 최적화 | 실전 관심사는 캐싱 |

**교훈**:
1. 대기업은 named 폴더 아키텍처(FSD 등)를 evangelize하지 않음. 도메인 맞춤 자체 레이어 정의 + 내부 가이드로 규칙 강제(배민·Money Forward).
2. MVVM(entities/도메인 레이어) + Server Actions는 실무 검증 조합(Money Forward).
3. **RSC 서버우선은 만능 아님 (Claude 정정)**. Artsy는 철회. 인터랙션 무겁고 DX 중요한 앱엔 독일 수 있음. 우리 앱 핵심(Monaco 통합 에디터)이 인터랙션 덩어리라 해당 → server-first 교조 금지, 정적 영역(목록·지문)만 RSC.
4. 대형사 아키텍처 방점 = 모노레포 운영·의존성·업그레이드.

**후보 추가**: **(C) 자체 정의 layered/도메인 구조**(배민·Money Forward식) — `features`/`entities` 모듈 + 명시적 레이어(View/ViewModel/Repository/Data) + 단방향 의존 규칙 + MVVM + Server Actions, RSC 부분 적용. → "트렌디 기업이 실제로 하는 것"에 가장 근접. Claude 잠정 추천.

출처: [배민](https://techblog.woowahan.com/15084/), [Money Forward](https://global.moneyforward-dev.jp/2025/12/04/migrating-to-the-next-js-app-router-or-how-i-learned-to-stop-worrying-and-love-server-actions/), [Artsy](https://artsy.github.io/blog/2024/03/07/nextjs-at-artsy-retrospective/), [Airbnb](https://medium.com/airbnb-engineering/rearchitecting-airbnbs-frontend-5e213efc24d2), [카카오엔터 캐싱](https://fe-developers.kakaoent.com/2024/240418-optimizing-nextjs-cache).

---

## 아이디어 / 열린 질문

프로젝트 전반에서 아직 해소 안 된 설계 리스크·아이디어. 해당 서비스 착수 시 ADR/아키텍처 문서로 승격.

- **생성 문제 정답 신뢰성**: LLM 생성물은 지문 모호·정답 불일치가 흔함. N개 독립 풀이 교차검증(출력 일치 시에만 정답 채택) + brute-force vs 최적 풀이로 제한조건 변별력 확인 + 사람 검수 게이트. 검수 UI·자동화 수준 미정.
- **데이터 라이선스 (최우선 리스크)**: 백준/프로그래머스/LeetCode 문제 수집·활용은 ToS·저작권 이슈. 공개 데이터셋 확보 또는 자체 시드 문제 구축 방안 선결 필요.
- **샌드박스 보안**: Docker 컨테이너 단독은 보안 경계가 아님. seccomp/cgroups/네트워크 차단/gVisor·nsjail 필요. Judge 착수 시 보안 노트로 상세화.
- **LLM 비용**: 생성·검증마다 다회 호출 발생 → 호출량·캐싱·배치 전략 초기부터 관리.
