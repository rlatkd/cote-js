# TODO / 로드맵

> 마일스톤은 [/README.md](../README.md) 16장 기반. 세부 작업은 여기서 체크리스트로 관리한다.

## 로드맵 (마일스톤)

- [ ] **M1 온라인 채점 코어(비동기)** — web(Next) + api(Kotlin/Spring) + PostgreSQL *(연결 ✅)*, 수기 등록 문제, Go Judge + 샌드박스, **Kafka 제출·결과 토픽(QoS 3레인) + MinIO claim-check** *(구 M1+M2 통합 — 동기 채점 단계 폐지, [ADR-0009](decisions/0009-judge-kickoff-async-and-contracts.md))*
- [ ] **M2 채점 스케일아웃** — Judge Worker 수평 확장, SSE Redis pub/sub 전환, 제출량 처리 *(구 M2에서 Kafka 도입이 M1로 이동한 잔여)*
- [ ] **M3 AI 생성 파이프라인** — LLM API + LangChain 생성, 사람 검수 게이트
- [ ] **M4 유사도/품질 검증** — 자체 임베딩 + pgvector 유사도, 정답 교차검증 자동화
- [ ] **M5 운영 고도화** — Kubernetes 이관, 모니터링/로깅, 랭킹·통계·콘테스트

## 현재 스프린트: 프론트 POC ✅

- [x] 프로젝트 스캐폴딩 (Next + TS + Tailwind 직접), `frontend/`로 이동
- [x] 공통 컴포넌트 (Navbar / 테마토글 / 뱃지), mock 데이터
- [x] 홈 페이지 (대시보드)
- [x] **프론트 아키텍처 확정** — 자체 도메인 레이어드([ADR-0004](decisions/0004-frontend-architecture.md))
- [x] `frontend/` 재배치: `app`/`views`/`entities`/`shared` 레이어 구성
- [x] 문제 목록 페이지 (+ 검색·난이도·AI 필터 client island)
- [x] 문제 상세 페이지 (통합 split view + Monaco)
- [x] 채점 현황 페이지
- [x] 의존성 설치 + build/dev 실행 검증 (5개 라우트 200, Tailwind content 경로 버그 수정)
- [x] 도메인 UI(뱃지) → `entities/*/ui` 이동 (레이어 경계 정합)
- [x] 레이어 의존성 규칙 ESLint(`import/no-restricted-paths`) 강제 — lint 통과
- [x] **디자인 시스템 1차 도입** — 색 토큰(CSS 변수 단일 진실원) + 서체(Pretendard/JetBrains Mono, next/font 셀프 호스팅) + 표면 위계 + 전역 focus-visible + 빈 상태 + AiBadge 통일 + 시그니처 모션. `next build` 통과, 5개 라우트 200 재검증.
- [x] **하드 재개편 "Instrument"** — 1차가 시각적으로 너무 보수적이라(체감 변화 미미) 강한 컨셉으로 전면 재설계: 모노 구조 언어 + 각진 기하 + **시그널 앰버**(임시 토글로 앰버/시안/라임/코발트 비교 후 확정) + 계기형 배지. 5개 화면 전부 적용. `next build` 통과, 5라우트 200. 상세: [디자인 시스템](architecture/web-design-system.md)
- [x] pnpm 전환 정합 — `pnpm-workspace.yaml`의 `allowBuilds`(unrs-resolver) 미완값 수정, `pnpm dev` 자동 브라우저 오픈([opener.js](../../services/web/opener.js)) 추가
- [x] **기본 테마 다크→라이트 전환** (2026-07-11) — themeScript·ThemeToggle 기본값 라이트, 라이트 팔레트 bg/surface 3단 위계 보정. [ADR-0002](decisions/0002-poc-scope-and-design.md) 갱신

## 현재 스프린트: 백엔드 hub(NestJS) 세로 슬라이스 ✅

- [x] **백엔드 언어 재선정** — Kotlin+Spring → TypeScript + NestJS + Prisma, 프론트·백 타입 공유(짝 A). [ADR-0005](decisions/0005-backend-language-and-type-sharing.md)
- [x] **모노레포 재편** — `frontend` → `platform/arena`, `platform/hub`(NestJS)·`platform/contracts` 신설, 루트 밑 `platform/` 워크스페이스. 서비스 네이밍(arena/hub/judge/setter/scout/tester) 확정. [ADR-0003](decisions/0003-monorepo-structure.md)
- [x] `@cotejs/contracts` — Problem·Submission 타입 + zod 스키마 + 순수 도메인 함수, 빌드
- [x] hub — Prisma(Problem/Example/Submission) + Postgres(docker-compose) + seed(mock 7문제·제출 10건)
- [x] hub — Problems·Submissions 모듈: `GET /api/problems`·`/:id`·`/api/submissions`, `POST /api/submissions`(zod 검증)
- [x] arena 배선 — `entities/*/model.ts`가 contracts 재수출, `entities/*/api.ts`가 mock → hub fetch. views·viewmodel 무변경
- [x] 엔드투엔드 검증 — install→contracts 빌드→docker→migrate/seed→hub 기동→curl(GET·POST·404·400) + arena `next build` + 실런타임 렌더(hub 데이터가 HTML에 반영, 5라우트 200)
- [x] 실행법 루트 README Quick Start + [architecture/api.md](architecture/api.md)

## 설계 매듭: 서비스 이음새 + AI 병합 (2026-07-25) ✅

- [x] **[ADR-0006](decisions/0006-service-seams-and-ai-consolidation.md)** — ① AI 3→2 병합(tester→setter 내부 모듈, scout만 독립) ② 채점 결과 경로(judge→Kafka 결과토픽→hub→SSE, judge DB 금지) ③ DB 스키마 단일 작성자 ④ 실행 QoS 3레인(run/submit/batch) ⑤ 파이프라인 지휘자=setter ⑥ 검수 UI=arena admin+hub admin ⑦ Redis 역할 명시(rate limit·리더보드·pub/sub). system-overview·ADR-0003·glossary·CLAUDE.md·README 반영
- [x] **살아있는 문서 4종 도입** (2026-07-25) — [worklog](worklog.md)(세션 연속성)·[learning-notes](learning-notes.md)(학습 축적)·[guides/verification](guides/verification.md)(검증 체크리스트)·[architecture/data-model](architecture/data-model.md)(ERD·소유권·부채). 갱신 트리거·타임스탬프 규칙을 CLAUDE.md에 고정

## 현재 스프린트: 백엔드 Kotlin 재구축 + 구조 재편 (2026-07-25) ✅

- [x] **백엔드 재복귀 결정** — NestJS → Kotlin+Spring, 모던 스택 강제(코루틴·WebFlux·R2DBC·Hexagonal, 실무 MVC/JPA 재탕 금지). [ADR-0007](decisions/0007-backend-kotlin-return.md) (0005 Superseded)
- [x] hub 재구현 — Boot 4.0.7(JDK 21 LTS)·Gradle Kotlin DSL, hexagonal 4계층, suspend 컨트롤러, R2DBC(JSONB·배열 매핑), Flyway V1 스키마+V2 시드(구 prisma seed 이관)
- [x] 계약 전환 — contracts 폐기 → springdoc OpenAPI → `pnpm gen:api`(schema.d.ts 커밋) + `contract-check.ts` 컴파일타임 검사
- [x] **폴더 재편** — `platform/` = 전 서비스 그룹으로 재정의(사용자 제안), hub를 `platform/hub`로, arena 단독 패키지화(그룹 pnpm 파일 흡수). [ADR-0003](decisions/0003-monorepo-structure.md) 2차 개정
- [x] **Docker 개발용 원칙** — compose=인프라만(postgres), 앱은 네이티브 실행. 앱 Dockerfile 제거(배포 M5에서 재도입)
- [x] 검증 — hub curl 스위트(200/201/404/400×2/OpenAPI) + arena `next build`(계약 체크 포함) + 4라우트 실렌더에 hub 데이터 확인
- [x] LTS/안정판 버전 정책 확정(JDK 21, Boot 4.0.x, Node 22, PG 16) — CLAUDE.md 규칙화

## 현재 스프린트: 서비스 네이밍 개편 + 시드 분리 (2026-07-25) ✅

- [x] **네이밍 2층 체계 확정** — 그룹 `platform`→`services`, `arena`→`web`, `hub`→`api`(Kotlin 패키지 `com.cotejs.api`), `setter`→`problem`, `scout`→`plagiarism`, `judge` 유지. [ADR-0008](decisions/0008-service-naming-and-group.md) (0003 동결)
- [x] **ADR 운영 규칙 확정** — 결정 변경 시 기존 ADR 원문 동결(상태만 Superseded) + 새 ADR 발행. [decisions/README](decisions/README.md)
- [x] **인프라 서비스별 Dockerfile** — `infra/postgres/Dockerfile` 신설(추후 pgvector 확장 자리), compose는 build 사용
- [x] **시드 분리(A안)** — `V2__seed.sql` → `db/seed/R__dev_seed.sql`(Repeatable·멱등), `spring.flyway.locations` 프로파일 제어(prod는 스키마만). 빈 DB에서 기동 한 방 재현 검증(7문제·10제출)
- [x] 검증 — api 리네임 후 컴파일·기동·curl 그린, web 빌드·4라우트 그린. 함정 재확인: 적용된 V 마이그레이션은 주석도 불변(체크섬)

## 현재 스프린트: Judge 착수 — 설계 확정 + 기반 구축 (2026-07-26) 🔄

- [x] **착수 설계 확정** — ① Kafka 직행(구 M1/M2 통합 — 동기 채점 단계 폐지) ② 테스트케이스 = claim-check(MinIO 번들, 메시지엔 키+해시) ③ IDL = Protobuf(Schema Registry 보류). [ADR-0009](decisions/0009-judge-kickoff-async-and-contracts.md)
- [x] **루트 `contracts/` 신설** — 언어 중립 IDL 거처, 루트 3→4개념(ADR-0008 개정). [ADR-0010](decisions/0010-contracts-root-group.md)
- [x] `contracts/proto/judge/v1` 초안(submission·result) — **확정은 judge 구현 시**(코드젠 도구 포함)
- [x] infra 확장 — kafka(KRaft 단일노드, apache/kafka 4.1.2, 이중 리스너)·minio Dockerfile + compose, 토픽 4종(`submission.run/submit/batch/result`)·`testdata` 버킷 명시 생성. 기동·init 검증 그린
- [x] **착수 시 결정 3건 확정 (2026-07-26)** — ① 샌드박스 = Docker 컨테이너 격리(커널 직접 제어는 별도 마일스톤, 러너 이미지는 judge 소유) ② 언어 = Python 단독(executor에 컴파일 단계 자리) ③ SSE 포함(인프로세스 pub/sub). [ADR-0009](decisions/0009-judge-kickoff-async-and-contracts.md)
- [x] **judge 코어 구현** (2026-07-26) — `services/judge`: domain(Task·Verdict·Runner 포트)·executor(번들→작업공간→실행→비교→집계)·Docker 샌드박스 어댑터·Python 러너 이미지(harness)·judgecli. 판정 5종(AC/WA/TLE/MLE/RE)+격리 2종(네트워크·fork bomb) 실채점 검증 그린. 상세: [architecture/judge.md](architecture/judge.md)
- [x] **judge 어댑터 + 파이프라인 관통** (2026-07-26) — 코드젠(buf CLI + 로컬 플러그인, BSR 미사용)·Kafka 어댑터(franz-go, 3레인 소비·결과 발행·at-least-once)·MinIO 번들 어댑터(해시 캐시)·`judged` 워커·`judgeprobe` 주입기. 왕복·캐시 재사용·**레인 우선순위(run→submit→batch)** 실측 검증. [ADR-0011](decisions/0011-codegen-and-kafka-client.md)
- [x] **api 배선 완료** (2026-07-27) — ① JVM 코드젠(buf + protoc 내장 java 생성기, 생성물 커밋) ② 제출 API → Kafka `submission.submit` 발행 ③ 결과 컨슈머 → **멱등 저장**(전량 재소비 실측 검증) ④ SSE(`/api/submissions/stream`, 인프로세스) ⑤ web 실시간 표시(제출 화면·채점 현황). **Kafka 클라이언트는 직접 사용** — reactor-kafka가 Boot 4의 kafka-clients 4.x와 바이너리 비호환(실측). [ADR-0012](decisions/0012-api-judge-wiring.md)
- [x] **데이터 모델 부채 상환** (2026-07-27) — 제한·측정값 수치화(V2), `test_case` 테이블(히든 케이스 진실원) + `problem.test_bundle_*`(claim-check 캐시), `submission.code`·`judged_at` 추가. web은 표시 포맷터로 대응
- [x] **테스트케이스 발행 경로** (2026-07-27) — api가 `test_case`로 번들을 만들어 MinIO에 올리고 참조를 캐시(제출 시 lazy). 시드에 문제 1000의 히든 케이스 5건 추가
- [x] **judge 언어 확장** (2026-07-28) — Python·Java·JavaScript 3종. `internal/language` 레지스트리(단일 진실원)·Go 정적 하니스 1벌·언어별 자원 강제(rlimit vs 힙 옵션)·컴파일 단계 실구현. **C++ 제거**(UI·enum·시드). 언어×판정 실측 검증. [ADR-0013](decisions/0013-judge-language-expansion.md)
- [x] **`run` 레인 배선 + 케이스별 결과** (2026-07-28) — 실행 모드(run/submit) 도메인화, 예제 번들 발행, 목록에서 run 제외, `submission_case` 저장·조회. web 목업 완전 제거. [ADR-0014](decisions/0014-execution-modes-and-case-feedback.md)
- [x] **타임존 UTC 통일** (2026-07-28) — V4 `timestamptz` + 도메인 `Instant` + DTO ISO-8601 + web 표시 변환. [ADR-0015](decisions/0015-cross-service-time-contract.md)
- [x] **공표 언어 층 신설** (2026-07-28) — `contracts/proto/common/v1`(trace·error). 추적 컨텍스트가 api→judge 로그로 이어지는 것 실측 확인. [ADR-0017](decisions/0017-published-language.md)
- [x] **첫 자동화 테스트** (2026-07-28) — judge executor 8종(출력 비교 경계·판정 우선순위·케이스 보존·미지원 언어·명세 불변식). 전략은 [ADR-0016](decisions/0016-test-strategy.md)
- [x] **api 테스트** (2026-07-28) — 단위 13종(도메인 규칙·제출 정책) + **통합 3종**(Testcontainers Postgres로 멱등 저장 고정). [ADR-0016](decisions/0016-test-strategy.md)
- [x] **CI 게이트** (2026-07-28) — [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): contracts(`buf lint`·PR에서 `buf breaking`)·judge(`go vet/build/test`)·api(`gradlew build` — 통합 테스트 포함)·web(`lint`+`build`=계약 체크). 샌드박스 실채점·전구간 E2E는 flaky 위험으로 의도적 제외(수동 절차 유지)
- [ ] **나머지 문제의 히든 테스트케이스** — 현재 1000번만 submit 채점 가능(예제 실행은 전 문제 가능). 단 시드 문제는 **버려질 픽스처**라 우선순위 낮음 — 데이터 라이선스 결론과 함께 판단
- [x] `aggregate()` 주입 리팩터링 (2026-07-30) — 출력 조달자(`outputOf`) 주입으로 순수 함수화, 메서드→자유 함수(리시버 미사용이 드러낸 신호). 출력 비교 판정(AC/WA)을 파일시스템 없이 검증하는 테스트 추가([ADR-0016](decisions/0016-test-strategy.md)이 드러낸 부채 상환)
- [ ] **스타터 코드 구조 개선** — 문제별 JSONB에 전 언어 코드를 박아두는 구조라 언어 추가 시 곱해진다. 언어별 기본 템플릿 + 문제별 오버라이드로 분리([ADR-0013](decisions/0013-judge-language-expansion.md))
- [x] **web→api 추적 연결** (2026-07-30) — Next 서버가 `traceparent` 발급(신뢰 경계 안), 제출을 **Server Action으로 이전**, api는 파싱·검증 후 이어받기(`TraceContext.parse/child` + 테스트). [ADR-0018](decisions/0018-observability-tracing.md)
- [x] **OpenTelemetry 도입** (2026-07-30) — api=Java 에이전트(bootRun, MDC trace_id 자동 주입) / judge=Go SDK 수동(`internal/telemetry`, 채점 1건=스팬 1개) / web=`@vercel/otel` / 백엔드=Jaeger 2.19 자가호스팅(infra). 전 구간 실측: 같은 trace_id가 3서비스 로그+Jaeger 스팬 트리에. [ADR-0018](decisions/0018-observability-tracing.md)
- [x] [`architecture/judge.md`](architecture/judge.md) 작성 (샌드박스 격리 요건·실증·한계를 포함 — 별도 보안 노트 대신 judge 문서 5장에 통합)
- [ ] **샌드박스 2단계** (별도 마일스톤): cgroups/namespaces/seccomp 직접 제어 — 케이스별 메모리 피크 정밀 측정(cgroup `memory.peak`), 언어 중립 MLE 판정, seccomp 화이트리스트. 리눅스 기준 개발 머신 결정 필요
- [ ] judge 언어 확장: C++·Java·JavaScript 러너 추가(executor 인터페이스 불변 — 컴파일 단계 자리 이미 확보)

## 현재 스프린트: 인증 ([ADR-0019](decisions/0019-authentication-kakao-oidc.md)) — 구현 완료 (2026-07-31)

- [x] **사용자 액션** (2026-07-30): 카카오 앱 등록 — OIDC 활성화, Redirect URI(개편 콘솔: [앱 → 플랫폼 키 → REST API 키] 상세), 닉네임 필수 동의, Client Secret. 자격 증명 `services/api/.env`(gitignore)
- [x] **V5 재도입** (2026-07-31) — `users` + `submission.user_id NOT NULL` + 조건부 시드 귀속. 기존 개발 DB(guest 픽스처 포함)에 귀속 실측 확인
- [x] JWT 코덱(HS256, JDK 내장) + 단위 테스트 6종(왕복·만료·변조·타키·타입 오용·깨진 입력) — 선별적 TDD
- [x] 카카오 OIDC — 코드 교환(WebClient)·JWKS 캐시(6h)·id_token 검증기 + 단위 테스트 6종(서명·kid·alg 바꿔치기·iss/aud/exp/nonce)
- [x] AuthService + 엔드포인트(login/callback/refresh/logout/me), state·nonce는 서명 쿠키(무상태)
- [x] 인증 WebFilter — principal 전파 + **POST /api/submissions 401 가드**(실측: `401 로그인이 필요합니다`) + 컨트롤러 이중 방어
- [x] `NewSubmission.by: AuthPrincipal` — body user 필드 폐기, 제출=로그인 필수를 타입 불변식으로. 영속 user_id 배선
- [x] web 배선 — Navbar 카카오 로그인/`@닉네임`+로그아웃, 세션은 layout(RSC)→props, Server Action 쿠키 포워딩, 401 안내
- [x] OpenAPI 재생성(auth 엔드포인트 +279줄) + 계약 체크 그린. api 전체 빌드(31 tests)·web 빌드 그린
- [ ] **실로그인 E2E(사용자 브라우저)** — 카카오 동의→복귀→닉네임 표시→제출→소유 귀속→로그아웃 (verification 절차 9)
- [ ] 후속: refresh 자동 갱신 web 배선(현재 access 만료 시 재로그인), 배포 시 secure 쿠키·시크릿 회전

## 보류 / 추후 재논의 (Deferred)

- [ ] api 후속: 인증/인가, 랭킹·통계(Redis sorted set), 페이지네이션, 제출 rate limiting(Redis)
- [ ] M3 범위: 사람 검수 게이트 UI — web admin 라우트(검수 큐) + api admin API
- [ ] AI 아키텍처 확정 시 [architecture/](architecture/) 상세화 (problem.md/plagiarism.md)
- [ ] api↔AI(problem·plagiarism) 경계 계약 — M3 착수 시 정의(방침: Protobuf 단일 IDL, [ADR-0009](decisions/0009-judge-kickoff-async-and-contracts.md))
- [ ] **Kafka Streams 재검토** — 실시간 통계·채점 SLA 모니터링 등 스트림 집계 요구가 기능으로 들어올 때. 적용 후보·탈락 후보는 [engineering-notes](engineering-notes.md)
- [ ] **Avro + Schema Registry 재검토** — 스키마 거버넌스(호환성 강제) 필요 시. Registry는 Protobuf도 지원하므로 IDL 교체 없이 추가 가능
- [ ] SSE 팬아웃 Redis pub/sub 전환 — api 다중 인스턴스(M2) 시점
- [ ] 데이터 라이선스 문제 결론 (공개 데이터셋 vs 자체 시드 문제)
- [ ] 향후 문서 생성: 테스트 전략(테스트 도입 시), 배포 런북(K8s 시) — 데이터 모델은 [architecture/data-model.md](architecture/data-model.md)로 완료
