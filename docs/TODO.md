# TODO / 로드맵

> 마일스톤은 [/README.md](../README.md) 16장 기반. 세부 작업은 여기서 체크리스트로 관리한다.

## 로드맵 (마일스톤)

- [x] **M1 온라인 채점 코어(비동기)** (2026-07-31 완료) — web(Next) + api(Kotlin/Spring) + PostgreSQL, 수기 등록 문제, Go Judge + 샌드박스(Docker 1단계), Kafka 3레인 + MinIO claim-check. 계획 외 추가 달성: 언어 3종·실행 모드·인증(카카오 OIDC)·관측(OTel)·CI
- [x] **M2 채점 스케일아웃** (2026-07-31 — 단일 머신에서 가능한 범위 완료) — **SSE Redis pub/sub 전환** ✅, **레인별 동시성 슬롯**(run2·submit2·batch1) ✅, **제출 rate limit**(Redis 고정 창) ✅, 페이지네이션 ✅. 잔여: 워커 **다중 프로세스** 실증(컨슈머 그룹은 준비됨 — 멀티 인스턴스 기동 검증은 배포 환경에서)
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
- [ ] **나머지 문제의 히든 테스트케이스** — 현재 1000번만 submit 채점 가능(예제 실행은 전 문제 가능). [ADR-0021](decisions/0021-data-licensing.md)로 방향 확정: 시드는 M3 생성 문제로 교체 예정이므로 **기존 시드에 케이스를 더 붓지 않는다** — M3 교체 시 자연 해소
- [x] `aggregate()` 주입 리팩터링 (2026-07-30) — 출력 조달자(`outputOf`) 주입으로 순수 함수화, 메서드→자유 함수(리시버 미사용이 드러낸 신호). 출력 비교 판정(AC/WA)을 파일시스템 없이 검증하는 테스트 추가([ADR-0016](decisions/0016-test-strategy.md)이 드러낸 부채 상환)
- [x] **스타터 코드 구조 개선** (2026-07-31, V6) — 언어별 기본 템플릿(`starter_template`) + 문제별 오버라이드로 분리([ADR-0020](decisions/0020-data-debt-starter-templates.md))
- [x] **web→api 추적 연결** (2026-07-30) — Next 서버가 `traceparent` 발급(신뢰 경계 안), 제출을 **Server Action으로 이전**, api는 파싱·검증 후 이어받기(`TraceContext.parse/child` + 테스트). [ADR-0018](decisions/0018-observability-tracing.md)
- [x] **OpenTelemetry 도입** (2026-07-30) — api=Java 에이전트(bootRun, MDC trace_id 자동 주입) / judge=Go SDK 수동(`internal/telemetry`, 채점 1건=스팬 1개) / web=`@vercel/otel` / 백엔드=Jaeger 2.19 자가호스팅(infra). 전 구간 실측: 같은 trace_id가 3서비스 로그+Jaeger 스팬 트리에. [ADR-0018](decisions/0018-observability-tracing.md)
- [x] [`architecture/judge.md`](architecture/judge.md) 작성 (샌드박스 격리 요건·실증·한계를 포함 — 별도 보안 노트 대신 judge 문서 5장에 통합)
- [ ] **샌드박스 2단계** (별도 마일스톤): cgroups/namespaces/seccomp 직접 제어 — 케이스별 메모리 피크 정밀 측정(cgroup `memory.peak`), 언어 중립 MLE 판정, seccomp 화이트리스트. 리눅스 기준 개발 머신 결정 필요
- [ ] judge 언어 확장: C++·Java·JavaScript 러너 추가(executor 인터페이스 불변 — 컴파일 단계 자리 이미 확보)

## 현재 스프린트: 인증 ([ADR-0019](decisions/0019-authentication-kakao-oidc.md)) ✅ (구현 2026-07-31 · E2E 검증 2026-08-01)

- [x] **사용자 액션** (2026-07-30): 카카오 앱 등록 — OIDC 활성화, Redirect URI(개편 콘솔: [앱 → 플랫폼 키 → REST API 키] 상세), 닉네임 필수 동의, Client Secret. 자격 증명 `services/api/.env`(gitignore)
- [x] **V5 재도입** (2026-07-31) — `users` + `submission.user_id NOT NULL` + 조건부 시드 귀속. 기존 개발 DB(guest 픽스처 포함)에 귀속 실측 확인
- [x] JWT 코덱(HS256, JDK 내장) + 단위 테스트 6종(왕복·만료·변조·타키·타입 오용·깨진 입력) — 선별적 TDD
- [x] 카카오 OIDC — 코드 교환(WebClient)·JWKS 캐시(6h)·id_token 검증기 + 단위 테스트 6종(서명·kid·alg 바꿔치기·iss/aud/exp/nonce)
- [x] AuthService + 엔드포인트(login/callback/refresh/logout/me), state·nonce는 서명 쿠키(무상태)
- [x] 인증 WebFilter — principal 전파 + **POST /api/submissions 401 가드**(실측: `401 로그인이 필요합니다`) + 컨트롤러 이중 방어
- [x] `NewSubmission.by: AuthPrincipal` — body user 필드 폐기, 제출=로그인 필수를 타입 불변식으로. 영속 user_id 배선
- [x] web 배선 — Navbar 카카오 로그인/`@닉네임`+로그아웃, 세션은 layout(RSC)→props, Server Action 쿠키 포워딩, 401 안내
- [x] OpenAPI 재생성(auth 엔드포인트 +279줄) + 계약 체크 그린. api 전체 빌드(31 tests)·web 빌드 그린
- [x] **실로그인 E2E(사용자 브라우저)** (2026-08-01 사용자 확인) — 카카오 동의→복귀→닉네임 표시→제출→소유 귀속→로그아웃 (verification 절차 9)
- [x] 후속: refresh 자동 갱신 web 배선 (2026-07-31 `SessionRefresher`로 완료 — 아래 스프린트)
- [ ] 후속(배포 M5): secure 쿠키·시크릿 회전

## 현재 스프린트: 부채 상환 + M2 스케일아웃 (2026-07-31) ✅

- [x] **V6 데이터 부채 일괄 상환**([ADR-0020](decisions/0020-data-debt-starter-templates.md)) — ① 스타터 코드: `starter_template`(언어별 공용, api 소유) + `problem.starter_code` 오버라이드 강등(보류했던 재결정 — judge 레지스트리와 분리: 채점 지식이 아니라 서빙 지식) ② `result` 저장값 enum name화(응답 라벨 계약은 불변 → web 무변경, name 집합은 테스트로 고정) ③ `submission.problem_title` 제거(조회 시 제목 프로젝션 조인)
- [x] **refresh 자동 갱신** — `SessionRefresher`(브라우저→api 직접: refresh 쿠키가 path=/api/auth라 Next 서버로는 안 옴) + CORS credentials(origin을 web으로 한정)
- [x] **Redis 도입**(infra 8.8.1-alpine) — 역할 한정(ADR-0006): SSE pub/sub·rate limit
- [x] **SSE 팬아웃 Redis pub/sub 전환**(M2) — `SubmissionEventHub` 인터페이스화 + Redis 구현. 실패 모드: Redis 다운 시 알림만 유실(채점 무관, 목록 조회로 복구)
- [x] **judge 레인별 동시성 슬롯**(M2) — run2·submit2·batch1, 폴 배치 병렬 처리 후 일괄 커밋(at-least-once 유지). 실측: run 2건 동시 시작. 대가(레인 내 제출 간 순서 상실)는 무해 — 순서 단위는 제출 1건(결과 키)
- [x] **제출 rate limit** — Redis 고정 창(INCR+EXPIRE), run 30/분·submit 10/분(설정), fail-open. 실측: 32연사 → 정확히 30×201+2×429
- [x] **페이지네이션** — `GET /api/submissions?limit&offset`(기본 50·상한 100), 전량 조회 계약 제거
- [x] **샌드박스 점검** — cap-drop ALL·no-new-privileges·read-only·nobody·스왑 금지는 **1단계에 이미 적용돼 있음을 확인**. 잔여(케이스별 memory.peak·seccomp 화이트리스트)는 컨테이너 내 서브 cgroup 제어가 필요해 Docker CLI로 불가 — 리눅스 환경 결정 대기 유지

## 현재 스프린트: M3 착수 — problem 서비스 ([ADR-0022](decisions/0022-m3-kickoff-problem-service.md)) 🔄

- [x] **api↔AI 계약 초안** (2026-08-01) — `contracts/proto/problem/v1`(generate·candidate, ValidationReport·REJECTED 관측 포함), buf lint 그린. 코드젠 템플릿 분리(`buf.gen.problem.yaml` — judge 오염 방지), CI 드리프트 검사 2템플릿화
- [x] **LLM 프로바이더 전략 확정(사용자)** — 개발=저가/무료(Gemini 무료 티어)로 배관, 주력은 품질 단계 실측 비교 후 재결정. 어댑터 격리(`llm/provider.py`)
- [x] **problem 스캐폴드** (2026-08-01) — Python 3.13+uv+FastAPI+LangChain 1.x, 생성 체인 v0(파서 방식)+CLI+/health, 페이크 테스트 3종 그린, CI problem 잡 추가
- [x] protoc 버전 매트릭스 35.1 정렬(CI pin·api protobuf-java 4.35.1) — macOS 신규 개발 머신 합류로 드러난 어긋남, api 빌드 그린
- [x] **사용자 액션: Gemini API 키 발급** (2026-08-01) — `services/problem/.env`(gitignore 확인). **실생성 첫 검증 그린** — Silver/BFS 자체 소재 문제, 스키마 준수. 단 예제 출력의 정답 여부는 미검증(validation 모듈의 일)
- [x] **validation 모듈 1차** (2026-08-01) — 독립 풀이 N개(지문만 노출 — `solution_sketch` 차단)·로컬 실행·합의 판정(순수 로직+실행기 주입). '풀이 간 합의 vs 초안 일치' 분리 진단, `problem-validate` CLI. **실측 E2E: 생성→풀이 3개→전원 일치→validated**. 테스트 7종 추가(총 10)
- [x] ~~⚠️ 임시 상태(파급 선언): 무격리 subprocess 실행~~ → **해소** (2026-08-03, [ADR-0023](decisions/0023-problem-kafka-wiring.md)) — executor.py 삭제, judge batch 레인 실채점으로 대체(음수 submission_id 공간·`CaseResult.output_sha256` 계약 보강)
- [x] **Kafka 배선** (2026-08-03, [ADR-0023](decisions/0023-problem-kafka-wiring.md)) — python codegen(`buf.gen.python.yaml` 신설, 전체 proto)·`problem-worker`(generate 수동커밋 소비→파이프라인→candidate 발행)·`problem-probe`(개발 주입기)·aiokafka+minio-py. judge 실채점 경로 실측 그린(수제 풀이 2정답+1오답 → validated·오답 변별)
- [x] **개발 프로바이더 OpenRouter 전환** (2026-08-03 사용자 확정, 경위는 engineering-notes) — Gemini 계정 결제 이슈(prepay 429, 신규 키도 동일 → 계정 단위)로 보류. `openrouter:` 프리픽스 어댑터+타임아웃 180s, 무료 모델 실측 3종 → `nemotron-3-super-120b` 확정(0.9s). 무충전(일 50 요청)으로 시작, $10 충전은 부족 시
- [ ] ⚠️ **행복 경로 왕복 1회 미완**(probe→worker→실생성→풀이 3개→judge 실채점→VALIDATED 후보) — 배선·실패 경로·재전달은 전부 실측됐고(초안 생성·failure 후보 2종 실전 확인), 남은 건 살아있는 모델로 **재시도 1회뿐**: judged+problem-worker 기동 후 `problem-probe`(verification 절차 11 '워커 왕복'). 550B 저속·gemma 풀 고갈로 이번 세션 미완주
- [ ] validation 2차 — brute-force 앵커(작은 입력 대조+TLE 변별), 히든 케이스 생성(합의 출력을 정답으로 채택 — **출력 원문 필요: 해시로는 부족, judge 출력 아티팩트 claim-check 재검토**, ADR-0023 한계), stress testing·적대적 반례(engineering-notes 후보 ⑥⑦)
- [ ] api 측 — 생성 요청 admin API·검수 큐 스키마(V7)·candidate 컨슈머(중복 후보 request_id 멱등 흡수 포함 — ADR-0023 전제)
- [ ] web admin — 검수 큐 UI(M3 검수 게이트)
- [ ] 시드 교체 — 검수 통과 생성 문제로 백준 파생 시드 5문제 대체(ADR-0021 부채)

## 현재 스프린트: 디자인 방향 전환 — 다크 터미널 (2026-08-06) 🔄

> 격리 실험실 `services/web/app/lab/`에서만 진행. **본 서비스는 아직 무변경**(사용자 지시: 의사결정 완료 후 적용).
>
> ⚠️ **랩 코드는 커밋하지 않고, 확정 후 삭제한다**(사용자 결정 2026-08-06). 워킹 트리에만 있으므로 `git clean` 시 날아간다 — 그래도 **결정은 문서에 자립해 있다**: 확정 팔레트 실측값·구조 결정은 [engineering-notes](engineering-notes.md) '디자인 방향 전환', 원리는 [learning-notes](learning-notes.md) '디자인'.

- [x] **`/lab` 실험실 신설** (2026-08-06) — 5화면(`home`·`problems`·`status` = 본 서비스 대응 / `verification`·`me` = 신규 제안), 헤더로 상호 이동. 전역 스타일·기존 컴포넌트 무변경(토큰 래퍼 오버라이드 + 오버레이로 이중 격리)
- [x] **6축 노브 시스템**([theme.ts](../services/web/app/lab/theme.ts)) — TERMINAL·DENSITY·CONTRAST·WARMTH·ACCENT·PIXEL 실시간 조절 + 수치 문자열 출력. 로그인 상태 토글 포함
- [x] **홈 확정 사항** — 노브 `terminal=65 density=0 contrast=70 warmth=100 accent=0 pixel=55` · Gruvbox 계열 웜 팔레트 · 비트맵 서체(한글 폴백) · 히어로 유지 · **무스크롤**(페인 내부 스크롤) · 로그인 스트립은 **비로그인에도 자리 유지**
- [ ] ⚠️ **홈 미결: PIPELINE 패널** — ① 유지 ② 제거 ③ **숫자 빼고 공정 4단계만 + `/verification` 링크(추천)**. 쟁점: 사용자 행동으로 이어지지 않는 admin 성격 vs 프로젝트 차별점을 보여주는 유일한 창
- [ ] 나머지 4화면 개별 검토(`problems`의 쿼리 줄 · `status`의 케이스 블록 · `verification` · `me`)
- [ ] **본 서비스 적용** — 확정 후. ⚠️ **다크 기본 전환은 [ADR-0002](decisions/0002-poc-scope-and-design.md)의 "라이트 기본"(2026-07-11 사용자 결정)을 뒤집으므로 새 ADR 발행 필요**. 적용 시 조절 패널 제거, 확정 값을 `globals.css` 다크 팔레트로 이관
- [ ] `/lab/login` 시안 — 별도 로그인 페이지(현재는 Navbar 버튼이 바로 카카오로 감)

## 보류 / 추후 재논의 (Deferred)

- [ ] **프로젝트 개명 `cote-js` → `opencote`** (2026-08-06 논의) — 가능하나 **라이선스가 선결**. 순서: ① 백준 파생 시드 5문제 자작 교체(ADR-0021 부채) → ② LICENSE(MIT) 부착 → ③ 개명. 지금은 README에 `Copyright … All rights reserved / License: TBD — MIT 예정` 한 줄로 충분. 잔여 리스크는 상표(opencode와 한 글자 차·동일 카테고리). 경위는 [engineering-notes](engineering-notes.md)
- [ ] **LICENSE 부착** — 현재 없음 = 법적 전권 유보라 "아무나 쓸 수 있게"라는 의도가 집행되지 않는 상태. **기여자가 생기면 비용이 뛰므로**(전원 동의 필요) 외부 PR 유입 전에 처리

- [ ] api 후속: ~~인증/인가~~(0019) · ~~페이지네이션~~ · ~~rate limiting~~(2026-07-31) → 잔여: **랭킹·통계(Redis sorted set — M5 리더보드와 함께)**, admin 문제 등록 API
- [ ] M3 범위: 사람 검수 게이트 UI — web admin 라우트(검수 큐) + api admin API
- [ ] M3 범위: **백준 파생 시드 5문제(1000·2231·1932·7576·9019) → 검수 통과한 생성 문제로 교체** ([ADR-0021](decisions/0021-data-licensing.md) 부채 — 공개 저장소의 시드 SQL도 재배포에 해당)
- [ ] M3 범위: 외부 공개셋 채택 시 개별 라이선스 실확인(후보: Project Euler·ICPC 계열·HF 데이터셋 — 내부 용도 한정, [ADR-0021](decisions/0021-data-licensing.md))
- [ ] **오판정 교정 경로** (2026-08-01 논의, learning-notes '오판정' 항 참조) — 문제 결함 발견 시 케이스 수정→batch 레인 전 제출 재채점(인프라는 있음, admin 트리거 부재), 유저 이의제기 채널. M3 검수 게이트와 함께 admin 축으로 판단
- [ ] AI 아키텍처 확정 시 [architecture/](architecture/) 상세화 (problem.md/plagiarism.md)
- [ ] api↔AI(problem·plagiarism) 경계 계약 — M3 착수 시 정의(방침: Protobuf 단일 IDL, [ADR-0009](decisions/0009-judge-kickoff-async-and-contracts.md))
- [ ] **Kafka Streams 재검토** — 실시간 통계·채점 SLA 모니터링 등 스트림 집계 요구가 기능으로 들어올 때. 적용 후보·탈락 후보는 [engineering-notes](engineering-notes.md)
- [ ] **Avro + Schema Registry 재검토** — 스키마 거버넌스(호환성 강제) 필요 시. Registry는 Protobuf도 지원하므로 IDL 교체 없이 추가 가능
- [x] **데이터 라이선스 결론** (2026-08-01, [ADR-0021](decisions/0021-data-licensing.md)) — 게시 문제=100% 자체 생산(M3 생성+검수), 외부 공개셋=내부 용도(few-shot 참고·M4 유사도 코퍼스)만+채택 시 라이선스 실확인, 크롤링·공개셋 게시 배제
- [ ] 향후 문서 생성: 테스트 전략(테스트 도입 시), 배포 런북(K8s 시) — 데이터 모델은 [architecture/data-model.md](architecture/data-model.md)로 완료
