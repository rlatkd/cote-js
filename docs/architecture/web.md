# 프론트엔드 아키텍처

- **관련 ADR**: [0004. 프론트엔드 코드 아키텍처](../decisions/0004-frontend-architecture.md)
- **상태**: Active

## 책임

문제 조회·풀이·제출 UI, 채점 결과·랭킹·통계 표시. 비즈니스 규칙은 Backend API가 소유하고, 프론트는 조회/입력/표현을 담당.

## 아키텍처: 자체 정의 도메인 레이어드

named 폴더 아키텍처(FSD 등)를 그대로 베끼지 않고, 배민·Money Forward 실무 사례를 참고해 도메인에 맞는 레이어를 정의한다.

**단방향 의존: `app → views → entities → shared`**

| 레이어 | 역할 | 서버/클라 |
|---|---|---|
| `app/` | 라우팅 전용(얇게). 서버에서 데이터 페칭 후 `views`에 전달 | 서버 |
| `views/` | 화면 단위 UI 조합 (`entities` + `shared/ui`) | 정적=서버 / 인터랙션=클라 |
| `entities/` | 도메인별 `model`(타입)·`api`(Repository)·`use-*`(ViewModel 훅) | - |
| `shared/` | 도메인 무관 공용 `ui`·`lib`·`hooks` | - |

## 폴더 구조

```
services/web/
├─ app/                          # 라우팅 (얇게)
│  ├─ layout.tsx                 # 루트 레이아웃 + Navbar + 폰트 변수 주입
│  ├─ globals.css                # 디자인 토큰(CSS 변수) + base + focus-visible
│  ├─ fonts.ts                   # next/font (Pretendard + JetBrains Mono)
│  ├─ fonts/                     # 셀프 호스팅 폰트 파일(PretendardVariable.woff2)
│  ├─ page.tsx                   # 홈 → views/home
│  ├─ problems/
│  │  ├─ page.tsx                # 목록 → views/problem-list
│  │  └─ [id]/page.tsx           # 상세 → views/problem-solving
│  └─ status/page.tsx            # 채점 현황 → views/submission-status
├─ views/                        # 화면 조합
│  ├─ home/
│  ├─ problem-list/              # 검색·난이도·AI 필터 (client island)
│  ├─ problem-solving/           # 통합 split view + Monaco (client)
│  └─ submission-status/
├─ entities/                     # 도메인 모듈
│  ├─ problem/
│  │  ├─ model.ts                # Problem 타입·도메인 로직(acceptanceRate 등)
│  │  ├─ api.ts                  # Repository (api API fetch — @/shared/api/api)
│  │  ├─ use-problem-solving.ts  # ViewModel (에디터·채점 상태 훅)
│  │  ├─ ui/DifficultyBadge.tsx  # 도메인 전용 UI (난이도 뱃지)
│  │  └─ ui/AiBadge.tsx          # AI 생성 표식(전역 통일)
│  └─ submission/
│     ├─ model.ts
│     ├─ api.ts
│     └─ ui/StatusBadge.tsx      # 도메인 전용 UI (채점 상태 뱃지)
├─ shared/
│  ├─ ui/                        # 도메인 무관 공용 (Navbar, ThemeToggle)
│  └─ api/api.ts                 # api(백엔드) 접근 공용 fetch 헬퍼
└─ ...config
```

> **타입은 `@cotejs/contracts` 공유**(짝 A). `entities/*/model.ts`는 계약 패키지에서 재수출만 한다([ADR-0005](../decisions/0005-backend-language-and-type-sharing.md)).

> **의존성 규칙은 ESLint로 강제**한다(`import/no-restricted-paths`, [`.eslintrc.json`](../../services/web/.eslintrc.json)). 도메인 전용 UI(난이도·상태 뱃지)는 `shared`가 아니라 해당 `entities`에 둔다 — `shared`가 `entities`를 참조하면 역방향 위반이라 lint 에러가 난다.

> **비주얼/디자인 토큰·서체·모션·접근성 규칙은 [디자인 시스템 문서](web-design-system.md)에 분리**했다. 색은 `globals.css`의 CSS 변수가 단일 진실원이고, 컴포넌트는 `bg-surface`·`text-muted`·`border-border` 같은 시맨틱 토큰만 쓴다(`dark:` 이중 표기 금지).

## 데이터 흐름 (RSC 방침)

- **정적/데이터 화면(홈·목록·지문·현황)**: `app/`의 서버 컴포넌트가 `entities/*/api`로 데이터를 페칭해 `views`에 props로 전달. `views`는 렌더링만.
- **인터랙션 화면(문제 풀이)**: `views/problem-solving`은 `"use client"`. 로직은 `entities/problem`의 ViewModel 훅으로 추출(MVVM).
- Artsy 교훈에 따라 **server-first를 교조적으로 적용하지 않음** — 인터랙션 덩어리는 client island로 명확히 분리.

## 상태 관리

- 서버 상태: RSC 서버 페칭 기본, 클라 캐싱 필요 시 TanStack Query(POC 이후).
- 클라 상태: 경량(테마·에디터 옵션)은 로컬 state / 필요 시 Zustand·Jotai.

## 데이터 연동

- **조회**: `entities/*/api.ts`(Repository)가 `shared/api/client.ts`로 **api(Kotlin/Spring)를 서버에서 fetch**한다(서버 컴포넌트). 응답 타입은 web 로컬 도메인 모델(`entities/*/model.ts`) — api OpenAPI 스키마와의 정합은 `shared/api/contract-check.ts`가 컴파일 타임에 검사([ADR-0007](../decisions/0007-backend-kotlin-return.md)).
- **제출**: `entities/submission/actions.ts`의 **Server Action**(2026-07-30, [ADR-0018](../decisions/0018-observability-tracing.md)에서 브라우저 직접 fetch → 이전). Next 서버를 거치는 이유: ① 추적 시작점=신뢰 경계 안(`traceparent` 발급) ② 인증 쿠키(httpOnly)가 first-party 유지(ADR-0019 선행 정지작업). 판정 수신은 여전히 SSE(`EventSource`, 브라우저→api 직접).
- **관측**: `instrumentation.ts`(+`next.config.mjs`의 `instrumentationHook`)에서 `@vercel/otel` 등록 — Next 내장 스팬 + fetch 전파(api 오리진은 `propagateContextUrls`에 명시해야 헤더가 실린다 — 기본은 같은 배포 URL 한정). `shared/api/trace.ts`는 활성 스팬이 있으면 그 컨텍스트로 traceparent를 만든다(임의 생성 시 계측이 주입하는 값과 어긋남).
- **인증**([ADR-0019](../decisions/0019-authentication-kakao-oidc.md)): 세션의 진실원은 api의 httpOnly 쿠키 — web은 읽을 수 없고(의도) `entities/auth/api.ts`가 매 렌더에 `/auth/me`로 묻는다(layout=RSC가 조회해 Navbar에 **props로** 전달 — shared는 entities를 import 못 하는 단방향 의존이라 데이터·Server Action을 주입받는다). 로그인=전체 페이지 이동(`/api/auth/login/kakao`), 로그아웃=`entities/auth/actions.ts`(쿠키 만료+api 통지). 제출 Server Action은 요청 쿠키를 api로 포워딩하고, 401은 "로그인이 필요합니다" 안내로 표시.
