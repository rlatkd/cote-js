# 작업 일지 (Worklog)

> **세션 단위 기록, 최신이 위.** 각 세션 종료 시 Claude가 갱신한다: ① 한 일 ② 검증한 것 ③ 중단점(어디서 끊겼나) ④ 다음 할 일. "왜"는 [engineering-notes](engineering-notes.md), "할 일 전체"는 [TODO](TODO.md) — 여기는 **세션 간 연속성** 전용.
>
> **표기 규칙**: 제목 = `YYYY-MM-DD HH:MM — 요약` (갱신 시각 필수). 세션 도중 큰 매듭이 지어지면 그 시점에도 추가 기입.

---

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
