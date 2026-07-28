# 작업 일지 (Worklog)

> **세션 단위 기록, 최신이 위.** 각 세션 종료 시 Claude가 갱신한다: ① 한 일 ② 검증한 것 ③ 중단점(어디서 끊겼나) ④ 다음 할 일. "왜"는 [engineering-notes](engineering-notes.md), "할 일 전체"는 [TODO](TODO.md) — 여기는 **세션 간 연속성** 전용.
>
> **표기 규칙**: 제목 = `YYYY-MM-DD HH:MM — 요약` (갱신 시각 필수). 세션 도중 큰 매듭이 지어지면 그 시점에도 추가 기입.

---

## 2026-07-28 21:35 — 언어 확장 · 실행 모드 · UTC 통일 · 공표 언어 · 첫 테스트 (ADR 5건)

- **한 일**: ① **judge 언어 확장**([ADR-0013](decisions/0013-judge-language-expansion.md)) — Python·Java·JavaScript 3종(C++ 제거), `internal/language` 레지스트리로 언어 지식 단일화, **하니스를 Go 정적 바이너리 1벌**로 재작성해 전 러너 이미지에 멀티스테이지 탑재, 언어별 메모리 강제(rlimit vs 런타임 힙 옵션)·시간 배수, 인터프리터 언어에도 문법 검사를 컴파일 단계로 부여, `Runner` 포트 2메서드→1메서드 통합 ② **실행 모드·케이스별 결과**([ADR-0014](decisions/0014-execution-modes-and-case-feedback.md), V3) — run(공개 예제·run 레인·목록 비노출)/submit(히든), `submission_case` 저장·일괄 조회, **web 목업 완전 제거** ③ **시간 규약**([ADR-0015](decisions/0015-cross-service-time-contract.md), V4) — `timestamptz`+`Instant`+ISO-8601 DTO+web 표시 변환 ④ **공표 언어 층**([ADR-0017](decisions/0017-published-language.md)) — `contracts/proto/common/v1`(trace·error) 신설, judge/v1이 이를 import, api가 trace 생성→judge가 이어받기, 실패의 구조화(귀책·재시도 가능 여부) ⑤ **첫 자동화 테스트**([ADR-0016](decisions/0016-test-strategy.md)) — judge executor 8종 ⑥ 문서: ADR 5건 + engineering-notes 논의 2건 + learning-notes 8건 + judge.md·api.md·data-model·verification·TODO·CLAUDE.md.
- **사용자 논의 3건(모두 문서화)**: **① 서비스 간 계약** — "각 서버별 컨버터로 충분한가"에서 출발해 ACL/Published Language/Shared Kernel로 정리, FinOS 학습자료(6종 정독)와 대조, 강제 지점의 층위(코드젠/메시/CI) 확립 → `contracts/` 격상으로 귀결 **② 테스트 전략** — "비중을 높이는 리스크는?"에 대해 6가지(설계 고착·거짓 안전감·목 과다·flaky·임의값 정답화·커버리지 왜곡) 정리 후 선별적 TDD 채택 **③ 문서화 규칙** — 논의가 대화에만 남는 문제를 사용자가 지적 → CLAUDE.md에 "논의는 그 턴 안에서 기록" 규칙 신설 + 개인 메모리 저장.
- **검증(실측)**: 언어 3종 × 판정(AC/CE/TLE/MLE/RE) — **컴파일 에러 경로 첫 검증**(3종 모두 실제 컴파일러 메시지) / 미지원 언어는 오판정 대신 명시적 실패 / run 모드가 히든 케이스 없는 문제(2231)를 공개 예제로 채점 + `lane=submission.run` + 목록 비노출 / 케이스별 결과(3번 케이스만 실패하는 Java 풀이 → 1·2·4·5 통과, 3만 실패) / 타임존 `14:22:10 KST → 05:22:10Z` 환산, 새 제출은 0.86초 차 / **추적 전파** — 같은 `trace_id`가 api·judge 로그 양쪽에 / `go test`·`buf lint`·api 컴파일·web 빌드 그린.
- **함정(실증)**: 하니스가 리눅스 전용 syscall을 써서 Windows 빌드가 깨짐 → `//go:build linux` + 스텁 분리. `@Bean` 팩토리명이 컴포넌트 클래스명과 겹쳐 기동 실패(재발). 목록 응답의 `cases`가 늘 비어 있던 문제 — SSE로만 채워지고 조회 경로엔 없었음(**응답에 필드가 있는데 항상 비면 계약이 거짓**).
- **추가(21:57)**: ⑦ **api 테스트** — 단위 13종(enum 레이블 왕복·제출 정책: 모드별 번들·레인, 데이터 미비 시 채점 오류, 번들 캐시 재사용) + **통합 3종**(Testcontainers Postgres로 멱등 저장·재채점 시 케이스 대체·미지 제출 흘려보내기). 손으로 하던 멱등성 검증이 코드가 됨 ⑧ **CI 게이트 신설** — [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): contracts(`buf lint`, PR에서 `buf breaking`)·judge(vet/build/test)·api(`gradlew build`)·web(lint+build=계약 체크). 샌드박스 실채점·E2E는 flaky 위험으로 의도적 제외. 로컬에서 전 단계 재현 확인.
- **중단점**: 전체 미커밋. CI는 파일만 있고 **아직 원격에서 돌아본 적 없음**(푸시 후 첫 실행에서 러너 환경 이슈가 나올 수 있음).
- **다음**: 인증(선별적 TDD의 첫 적용 대상 — 정책이 명확하고 인프라 의존이 적다) 또는 web→api 추적 연결. 샌드박스 2단계·언어 확장은 별도 마일스톤.

## 2026-07-27 23:13 — api↔judge 배선 완료: web 제출이 실제로 채점된다

- **한 일**: ① **JVM 코드젠**(buf + protoc 내장 java 생성기, `services/api/src/main/proto-gen` 커밋, Gradle sourceSets 연결) ② **데이터 모델 부채 상환**(V2 마이그레이션) — 제한·측정값 수치화(`time_limit_ms`·`memory_limit_mb`·`exec_time_ms`·`memory_used_kb`), `test_case` 테이블 신설(히든 케이스 진실원), `problem.test_bundle_*`(claim-check 캐시), `submission.code`·`judged_at`. 시드 변환 + 문제 1000 히든 케이스 5건 ③ **api 배선** — `KafkaJudgeDispatcher`(제출→레인 토픽), `JudgeResultConsumer`(결과→멱등 반영), `MinioBundleStore`(번들 발행, 결정적 패킹), `SubmissionEventHub`+`/api/submissions/stream`(SSE) ④ **web 배선** — 표시 포맷터(수치→"1초"/"30 ms"), `useSubmissionStream`(EventSource), 채점 현황 client island화, 제출 버튼이 실채점으로 ⑤ [ADR-0012](decisions/0012-api-judge-wiring.md) 발행 + 문서 정합(api.md·data-model·verification 절차7·TODO·CLAUDE.md·learning-notes 4건).
- **결정 변경(실측으로 뒤집힘)**: 사용자 승인은 **reactor-kafka**였으나 런타임에서 `NoSuchMethodError` — reactor-kafka 최신(1.3.25)도 kafka-clients **3.9** 기준이라 Boot 4의 **4.1**과 바이너리 비호환. 대안 검토(클라이언트 다운그레이드 vs 래퍼 제거) 후 **kafka-clients 직접 사용 + 코루틴**으로 전환(프로듀서=콜백→`suspendCancellableCoroutine`, 컨슈머=`Dispatchers.IO.limitedParallelism(1)`).
- **검증(실측)**: 전 구간 관통(api 제출→Kafka→judge→결과→DB) 정답·오답 모두 / **SSE 2이벤트**(채점 중→맞았습니다) / **멱등성** — 새 컨슈머 그룹으로 결과 토픽 전량 재소비해도 DB 완전 불변(13건·정답 7건·`judged_at`까지) / web 4라우트 200 + `next build`(계약 체크 포함) 그린.
- **버그 2건(실측 발견·수정)**: ① 빈 이름 충돌 — `@Bean` 팩토리 메서드명이 컴포넌트 클래스명(`judgeResultConsumer`)과 겹쳐 기동 실패 ② **타임존 9시간 어긋남** — judge의 UTC를 그대로 저장해 `submittedAt`/`judgedAt` 불일치. 로컬존 변환으로 수정하고 **근본 해결(`timestamptz` UTC 통일)은 부채로 기록**.
- **스택 원칙 완화(사용자 확인)**: "실무 재탕 **금지**"는 Claude가 규칙화한 문구로 의도보다 경직됐음 → *"실무 중복은 기본 회피하되 **기술적 적합성이 우선**"*으로 완화. 기존 결정은 전부 독립적 기술 근거가 있어 유지(CLAUDE.md·ADR-0007 보충 노트·api.md·README 반영).
- **중단점**: 전체 미커밋. **문제 1000만 채점 가능**(다른 문제는 히든 케이스가 없어 '채점 오류'), **예제 실행은 여전히 목업**(run 레인 미배선 — 화면에 명시).
- **다음**: run 레인 배선(공개 예제 번들) / 케이스별 결과 저장 / 나머지 문제 히든 케이스 / 타임존 UTC 통일. 또는 api 후속(인증·랭킹·rate limit).

## 2026-07-26 20:21 — judge 파이프라인 관통(Kafka·MinIO) + ADR-0011

- **한 일**: ① **코드젠 확정** — buf CLI + **로컬 플러그인**(BSR 미사용). 최초엔 원격 플러그인을 추천했으나 사용자가 "외부 솔루션 의존"을 지적 → buf가 CLI(오픈소스)/BSR(SaaS) 두 층임을 확인하고 수정. `contracts/buf.yaml`·`buf.gen.yaml` 신설, Go 생성물(`services/judge/gen`) 커밋 ② **Kafka 어댑터**(franz-go) — 3레인 소비·결과 발행, **at-least-once**(수동 커밋), 폴 배치 내 레인 우선순위 정렬, poison message 스킵, 장애 시에도 INTERNAL_ERROR 결과 발행 ③ **MinIO 번들 어댑터** — claim-check 완성(콘텐츠 해시 캐시·`.complete` 마커·staging→rename·해시 불일치 거부·zip slip 방어) ④ `cmd/judged`(워커)·`cmd/judgeprobe`(개발용 제출 주입기) ⑤ [ADR-0011](decisions/0011-codegen-and-kafka-client.md) 발행 + 문서 정합(judge.md 8~10장 추가, learning-notes 8건, engineering-notes 판단 로그, verification 절차 6, RUN, TODO, CLAUDE.md 확정 사항 3행).
- **검증(실측)**: `buf lint`·`buf generate`·`go build` 그린. **왕복** — 번들 업로드(MinIO)→제출 발행→judged 채점→결과 수신(AC/WA, 케이스별 포함). **캐시** — 동일 번들 2회차 다운로드 생략(851ms→653ms), 캐시 키=sha256. **QoS** — batch·batch·submit·run 순 적재 후 워커 기동 → **run→submit→batch→batch** 순 처리 + 같은 레인 내 도착 순서 보존.
- **함정(실증)**: 백그라운드 워커를 `| head -8`로 파이프하면 **head 버퍼가 로그를 삼켜** 메시지를 소비했는데도 조용하다 — 순서 검증을 오판할 뻔했다(파이프 없이 재실행해 확인). verification에 명시.
- **중단점**: 전체 미커밋. **at-least-once의 짝인 api 멱등 저장이 아직 없다**(중복 결과가 오면 그대로 중복 저장됨) — 다음 슬라이스 필수. JVM Protobuf 생성기도 미결.
- **다음**: api 배선 — JVM 생성기 확보 → 제출 프로듀스 → 결과 컨슈머(멱등) → SSE → web 표시.

## 2026-07-26 20:05 — judge 코어 구현(Go) + 실채점 검증 + 판단 근거 문서화 규칙 신설

- **한 일**: ① 보류 3건 확정(샌드박스=Docker 컨테이너 격리 / 언어=Python 단독 / SSE 포함 — 추천안대로) → ADR-0009 '보류' 절을 확정 기록으로 갱신 ② **`services/judge` 코어 구현** — domain(Task·Verdict·Runner 포트)·executor(번들 로드→작업공간→컴파일 자리→실행→출력 비교→판정 집계)·Docker 샌드박스 어댑터·Python 러너 이미지(harness.py)·judgecli(전송 무관 검증 CLI) ③ **[architecture/judge.md](architecture/judge.md) 신설** — 구조 + 설계 판단(경계 위치·컨테이너 수명·메모리 이중 한도·판정 책임 분리·출력 비교 규칙)·격리 요건 표·알려진 한계(별도 보안 노트 대신 여기 통합) ④ **사용자 지시 반영**: 기술 트레이드오프를 결론이 아니라 고민 과정까지 상세 기록 — CLAUDE.md 작업 원칙에 규칙 고정(문제정의·선택지·배제이유·뒤집히는 조건·한계 6요소), learning-notes에 심화 11건(SSE↔WebSocket 비교표 재작성, Protobuf↔Avro, 채점 도메인 9건), engineering-notes에 구현 판단 로그 ⑤ verification.md에 judge 절차(판정 5종+격리 2종) 신설, architecture/README·TODO 갱신.
- **검증(실채점)**: `go vet`·`go build` 그린, 러너 이미지 빌드 성공. A+B 3케이스 번들로 **AC**(24ms/9.3MB) **WA** **TLE**(1000ms 컷) **MLE**(RLIMIT_AS) **RE**(0으로 나누기) 전부 의도대로. 격리: `urlopen` 외부 통신 실패(DNS 대기→TLE, "escaped" 미출력) / fork bomb은 `--pids-limit`에 막혀 RE, 호스트 영향 없음.
- **함정(실증)**: `exec.CommandContext`는 docker CLI만 죽이고 **컨테이너는 생존** → 이름 붙여 `docker kill` 명시 호출. 컨테이너 `--memory`만 걸면 OOM killer가 harness를 죽여 유저 MLE가 INTERNAL_ERROR로 둔갑 → 정밀 한도는 제출 프로세스에 `RLIMIT_AS`, 컨테이너는 +64MB backstop.
- **중단점**: 전체 미커밋. judge는 코어만 — Kafka·MinIO 어댑터 미착수(proto 코드젠 도구도 미확정, protoc·buf 미설치 확인됨).
- **다음**: judge Kafka 어댑터(3레인 소비·결과 발행) → MinIO 번들 어댑터(해시 캐시) → api 프로듀서·결과 컨슈머 → SSE → web 배선.

## 2026-07-26 19:38 — Judge 착수 설계 확정(ADR-0009·0010) + contracts/·Kafka·MinIO 기반 구축

- **한 일**: ① Judge 착수 논의(어젠다 6개) — **①Kafka 직행(구 M1/M2 통합, 동기 채점 폐지) ②테스트케이스=claim-check(MinIO) ③IDL=Protobuf 확정**, ④샌드박스 수준 ⑤언어 범위 ⑥SSE는 **사용자 지정으로 착수 시 결정 보류**(추천안은 ADR에). Kafka Streams는 현 범위 미적용(적용 후보는 engineering-notes에 기록) ② [ADR-0009](decisions/0009-judge-kickoff-async-and-contracts.md)(착수 설계)·[ADR-0010](decisions/0010-contracts-root-group.md)(루트 `contracts/` 신설 — 0008 개정, 루트 4개념) 발행 ③ `contracts/proto/judge/v1` 초안(submission·result) ④ infra 확장 — kafka(KRaft 단일노드, apache/kafka 4.1.2, 이중 리스너, 토픽 명시 생성 init)·minio(2025-09 고정, `testdata` 버킷 init) ⑤ 문서 정합 — TODO(M1=비동기 코어/M2=스케일아웃 재편+Judge 스프린트 신설), CLAUDE.md 확정 사항, 루트 README(마일스톤·결정 요약·스택 표·이음새), system-overview, glossary(claim-check·KRaft·MinIO), engineering-notes(논의 경위+Streams 후보), RUN·getting-started.
- **검증**: `docker compose config` OK → 기동: postgres·kafka·minio 전부 healthy, kafka-init 토픽 4종(`submission.run/submit/batch/result`) 생성 확인, minio-init `testdata` 버킷 생성 확인, 호스트에서 kafka :9092 TCP·minio health 200 확인. 이미지 버전은 Docker Hub 실측(최신 4.3.1 → 안정판 4.1.2 선택).
- **중단점**: 전체 미커밋(커밋은 사용자 담당). proto는 초안 상태 — judge 구현 시 확정(코드젠 도구 포함).
- **다음**: 보류 3건(샌드박스·언어 범위·SSE) 결정 → judge 코어(executor·sandbox) 구현 착수. 시드 히든 테스트케이스+번들 업로드는 그 흐름에서.

## 2026-07-26 18:59 — Windows 인코딩 버그 수정 (JSONB 한글 모지바케)

- **한 일**: ① Docker Desktop WSL 기동 실패(`0x800705aa`, 메모리 부족) 재부팅으로 해소 → 인프라·api·web 기동 ② **Windows에서 에디터 starterCode 한글 주석 깨짐 수정** — 원인: Gradle `bootRun`이 데몬 네이티브 인코딩(MS949)을 `-Dfile.encoding`으로 포크 JVM에 전달(JEP 400 기본값 덮음) + `Json.asString()`이 기본문자셋 디코딩. 수정: [PersistenceAdapters.kt](../services/api/src/main/kotlin/com/cotejs/api/adapter/outbound/persistence/PersistenceAdapters.kt) `asString()`→`asArray()`(근본) + [build.gradle.kts](../services/api/build.gradle.kts) `JavaExec.defaultCharacterEncoding="UTF-8"`(방어) ③ learning-notes에 인코딩 3층 해부 기록.
- **검증**: 진단 체인 실측(시드 SQL=UTF-8 정상 → DB psql 정상 → api 응답만 깨짐 → jcmd로 `file.encoding=x-windows-949` 확증). 수정 후 4개 언어 starterCode 주석 전부 정상 + JVM `file.encoding=UTF-8` 확인.
- **함정(실증)**: TaskStop/Ctrl+C로 Gradle 래퍼를 죽여도 **포크된 Spring Boot JVM이 고아로 살아남아 :4000 점유** → 새 bootRun이 포트 충돌로 죽고 구 버전이 계속 응답(수정이 반영 안 된 것처럼 보임). 재기동 검증 시 `jps`로 구 프로세스 생존 확인 필수.
- **중단점**: 수정 미커밋(커밋은 사용자 담당). 서버 3종 기동 중.
- **다음**: Judge(Go) 착수 논의 — 제출·결과 토픽 IDL 확정부터([ADR-0006](decisions/0006-service-seams-and-ai-consolidation.md)).

## 2026-07-25 16:17 — 네이밍 2층 체계(ADR-0008) + 시드 A안 + ADR 동결 규칙

- **한 일**: ① 서비스 네이밍 전면 개편 — `platform→services`, `arena→web`, `hub→api`(Kotlin 패키지 `com.cotejs.api`, `ApiApplication`), 미착수 서비스 `setter→problem`·`scout→plagiarism`·`judge` 유지. [ADR-0008](decisions/0008-service-naming-and-group.md) 신설, 0003 원문 동결 ② **ADR 운영 규칙 확정**(개정=원문 동결+새 ADR — 사용자 지적 반영) ③ `infra/postgres/Dockerfile` 신설(compose는 build 사용) ④ **시드 A안**: `V2__seed.sql`→`db/seed/R__dev_seed.sql`(Repeatable·멱등), locations 프로파일 제어(+`application-prod.yml`) ⑤ web fetch 헬퍼 `hub.ts→client.ts`(apiGet/API_URL) ⑥ 현행 문서 전체 신명 스윕(동결 ADR·역사 기록 제외), architecture 파일명 `hub.md→api.md`·`frontend.md→web.md`·`frontend-design-system.md→web-design-system.md`.
- **검증**: api 컴파일·기동·curl 그린 / web 빌드 그린 / **빈 DB 리셋 후 기동 한 방에 V1+R__seed 적용(7문제·10제출) 재현 확인**.
- **함정(실증)**: 일괄 sed가 적용된 Flyway V1 주석을 건드려 체크섬 불일치 기동 실패 → 원복. 적용된 V 마이그레이션은 주석 한 글자도 불변. (V1 주석의 "hub" 잔존은 그래서 의도된 것)
- **중단점**: 전체 미커밋. web 서버 재기동 후 사용자 확인 대기.
- **다음**: 커밋 → Judge(Go) 착수 논의.

## 2026-07-25 14:07 — 백엔드 Kotlin 재구축 + platform 재편 + 개발용 도커 원칙

- **한 일**: ① [ADR-0007](decisions/0007-backend-kotlin-return.md) — NestJS→Kotlin+Spring 복귀(모던 스택 강제: 코루틴·WebFlux·R2DBC·Hexagonal, 실무 재탕 금지). hub 재구현(Boot 4.0.7/JDK21/Gradle, hexagonal 4계층, Flyway 스키마+시드 이관) ② 계약 전환 — contracts 폐기→OpenAPI codegen(`gen:api`)+`contract-check.ts`(컴파일타임 드리프트 검출) ③ **platform/ = 전 서비스 그룹 재정의**(사용자 제안, ADR-0003 2차 개정) — hub를 platform/hub로, arena 단독 패키지화 ④ compose 인프라 전용화(postgres만)+앱 Dockerfile 제거 ⑤ CLAUDE.md 작업 원칙 4·5 신설(결정 파급 즉시 표면화 / 대화·구현 구분 — 사용자 질책 반영, 영구 메모리에도 기록) ⑥ 문서 전면 정합(ADR 3건·CLAUDE.md·hub.md·system-overview·data-model·glossary·README·RUN·getting-started·verification·TODO).
- **검증**: hub curl 스위트 전부 그린(7문제/10제출/201/404/400×2/OpenAPI 200, 기동 ~2초) · arena `next build` 통과(계약 체크 포함) · 재편 후 4라우트 200 + hub 데이터 실렌더.
- **함정 기록**: Flyway 플레이스홀더 vs PG 달러 인용(`placeholder-replacement: false`), r2dbc-postgresql은 JSONB 코덱 때문에 implementation 의존.
- **중단점**: 전체 미커밋(구조 재편 포함 대량 변경 — 커밋은 사용자 담당). **서비스 이름 재논의**가 사용자 큐에 걸려 있었으나 Kotlin 재론으로 밀림 — 미해결.
- **다음**: ① 커밋 ② 이름 재논의(사용자 발제) ③ Judge(Go) 착수 논의.

## 2026-07-25 12:48 — 전체 구성 리뷰 → ADR-0006 + 살아있는 문서 도입

- **한 일**: 전체 서비스 구성 리뷰(적재적소 심문: judge=Go 재확인, AI 3→2 병합 결정) → [ADR-0006](decisions/0006-service-seams-and-ai-consolidation.md)(이음새 6규칙: 결과경로 SSE·DB 단일작성자·QoS 3레인·지휘자 setter·검수 UI·Redis 역할) 신설, 문서 8종 반영(system-overview 재서술, ADR-0003 개정, glossary·CLAUDE.md·루트 README·TODO·notes). 루트 `frontend/` 잔재(미추적 빌드 산출물) 삭제. 살아있는 문서 4종 신설(worklog·learning-notes·verification·data-model) + 타임스탬프 규칙 도입.
- **검증**: 문서 정합 grep(tester 잔재 확인 — 역사 기록만 잔존, 의도적). 코드 무변경.
- **중단점**: 문서 변경 커밋 대기 (커밋·푸시는 사용자 담당. 추천 메시지: `docs: 서비스 이음새 규칙(ADR-0006)·AI 병합·살아있는 문서 도입`).
- **다음**: hub 후속(인증/랭킹/rate limit) 또는 Judge(Go) 착수 논의. Judge 착수 시 제출·결과 토픽 IDL 확정부터.

## 2026-07-11 22:05 — (병렬 세션 B) NestJS hub + platform 재편 (커밋 535684f)

- **한 일**: 백엔드 재선정(Kotlin+Spring → NestJS+Prisma, [ADR-0005](decisions/0005-backend-language-and-type-sharing.md) 짝 A) · 모노레포 재편(`frontend`→`platform/arena`, `platform/hub`·`platform/contracts` 신설) · 서비스 네이밍 확정(arena/hub/judge/setter/scout/tester) · hub 구현(Prisma 3모델+seed, Problems/Submissions 모듈, zod 검증) · arena를 mock→hub fetch로 배선 · 기본 테마 다크→라이트 전환.
- **검증**: E2E — contracts 빌드→docker→migrate/seed→hub 기동→curl(GET/POST/404/400)→arena build+실렌더 5라우트 200.
- **잔여**: 채점은 stub("채점 중"). 인증·랭킹·페이지네이션 미구현.

## 2026-07-11 15:52 — (세션 A) 디자인 "Instrument" 재개편 (커밋 ff7a310)

- **한 일**: pnpm 정합(`allowBuilds` 수정으로 `pnpm dev` 복구) + opener.js(자동 브라우저) → 디자인 5축 진단("LLM median" 문제 제기) → 1차 토큰 도입(보수적이라 체감 실패 — 교훈 기록) → **"Instrument" 하드 재개편**(모노 구조어·각진 기하·시그널 앰버·계기 배지, 5화면 전부) → 임시 액센트 토글(4색 비교)로 앰버 확정 후 제거.
- **검증**: `next build` + 5라우트 200 + 헤드리스 렌더 확인.

## 2026-07-11 10:04 — 프론트 POC 구현 + 레이어드 재배치 (커밋 36a19c0 외)

- **한 일**: Next POC 4화면(홈/목록/상세 split view+Monaco/채점현황), 자체 도메인 레이어드(`app→views→entities→shared`, [ADR-0004](decisions/0004-frontend-architecture.md)) 재배치, ESLint `import/no-restricted-paths`로 레이어 의존 강제.
- **검증**: build + 5라우트 200, lint 통과.

## 2026-07-09 21:36 — 프로젝트 설계 (커밋 ef3dc08 외)

- **한 일**: 시스템 설계 청사진(루트 README 16장), 기술 스택·POC 범위·모노레포 구조 확정([ADR-0001](decisions/0001-tech-stack.md)~[0003](decisions/0003-monorepo-structure.md)), docs 체계(ADR/notes/TODO/architecture/guides/glossary) 구축.

> 2026-07-25 이전 기록은 git log(커밋 시각)·TODO 스프린트 기록에서 소급 작성한 요약(백필).
