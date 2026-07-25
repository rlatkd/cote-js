# 프론트엔드 디자인 시스템 — "Instrument"

- **관련**: [프론트엔드 아키텍처](web.md), [ADR-0002 POC 범위·디자인](../decisions/0002-poc-scope-and-design.md)
- **상태**: Active
- **도입 배경(논의·대안·인과)**: [engineering-notes.md](../engineering-notes.md)의 "디자인 시스템" 항목

## 컨셉

**"Instrument" — 알고리즘 크래프트를 위한 정밀 계기.** 친근한 SaaS도, 알록달록 교육앱도 아닌 **진지하게 엔지니어링된 도구**. 고급 코드 에디터 × 계측기 × 스펙시트의 감각.

LLM 기본 UI(median)의 세 tell — ① 라운드 박스 반복 ② 제네릭 블루 ③ 시스템 폰트 — 을 정면으로 거부한다. "안 나쁨(median)"이 아니라 **"의도가 만져지는" 얼굴**을 목표로 한다.

## 4개 기둥

1. **모노를 구조 언어로** — 코드뿐 아니라 네비·라벨·수치·메타데이터·버튼까지 JetBrains Mono. *읽는 글*(문제 지문·설명)만 Pretendard. → "데이터 계기" 질감.
2. **각지고 정밀한 기하** — 라운드 최소화(≤2px), 1px 헤어라인을 도면처럼 구조에 사용, 그리드 정렬.
3. **시그널 앰버 단일 액센트** — `#ff8a00`. median 블루·AI 보라·성공 초록을 전부 피한 유일한 강 액센트. 근-검정 위에서 "라이브 신호"처럼 발광. CRT 터미널 앰버 계보 = 도메인 서사.
4. **캔디 배지 → 계기 표시** — 색 알약 대신 도트 + 모노 라벨, 헤어라인.

## 색 토큰 (Single Source of Truth)

색 값은 [`app/globals.css`](../../services/web/app/globals.css)의 CSS 변수(`:root`=라이트, `.dark`=다크)만 소유. [`tailwind.config.ts`](../../services/web/tailwind.config.ts)는 시맨틱 이름→변수 매핑만. **라이트 기본, 다크는 토글**(2026-07-11 전환 — 팔레트는 앰버 액센트를 다크에서 먼저 설계했으나 기본 테마는 라이트로, 라이트 bg/surface 위계 보정).

| 토큰 | 역할 | 라이트 | 다크 |
|---|---|---|---|
| `bg` | 페이지(근-검정 캔버스) | `#ffffff` | `#0a0a0a` |
| `surface` | 카드·패널 | `#ffffff` | `#141414` |
| `elevated` | 보조 면·헤더·코드블록 | `#f5f5f5` | `#1c1c1c` |
| `border` | 헤어라인 | `#e2e2e2` | `#2a2a2a` |
| `border-strong` | 강조 라인·2차 버튼 | `#c8c8c8` | `#404040` |
| `fg` / `muted` / `faint` | 본문 / 보조 / 3차 텍스트 | `#0a0a0a` / `#6e6e6e` / `#a5a5a5` | `#f5f5f5` / `#8a8a8a` / `#585858` |
| `brand` | 시그널 앰버 | `#c85c00` | `#ff8a00` |
| `brand-hover` | 앰버 hover | — | `#ffa22e` |
| `brand-ink` | **앰버 위 텍스트** | `#fff` | `#0a0a0a` |

- **투명도 유틸 지원**: `"R G B"` 채널 저장 + `<alpha-value>` → `bg-elevated/60`, `text-brand/40` 등 동작.
- **`brand-ink` 규칙**: 앰버 배경 위 텍스트는 항상 `text-brand-ink`(다크에선 근-검정). `text-white`를 앰버 위에 쓰지 말 것(저대비).
- 중립은 zinc(푸른기) 대신 **순수 뉴트럴**로 이동 → 앰버가 더 도드라짐.

## 기하 · 타입

- **borderRadius 스케일을 각지게 재정의**(sm 1px / DEFAULT·md·lg 2px / xl 3px). `rounded-*` 클래스를 그대로 써도 전부 각짐. 도트·원만 `rounded-full`.
- **서체**([`app/fonts.ts`](../../services/web/app/fonts.ts), `next/font` 셀프 호스팅): UI/구조=**JetBrains Mono**, 읽는 글=**Pretendard**. 수치는 `font-mono tabular-nums`.
- **스펙시트 라벨**: 재사용 유틸 `.mono-label`(globals.css `@layer components`) = 대문자·자간 `0.14em`·11px 모노. 섹션 헤더·통계 라벨·테이블 헤더 전역에서 사용. **주의**: 커스텀 컴포넌트 클래스라 `[&>th]:mono-label` 식 arbitrary variant는 안 먹음 → 그럴 땐 실제 유틸리티를 나열한다.

## 시그니처 모티프

- **터미널 캐럿**: 워드마크 `cote.js` + 깜빡이는 앰버 블록 `▍`(`animate-blink`).
- **경로 모티프**: 네비 링크 `/home /problems /status`(모노), 활성 = 앰버 하단바.
- **`//` `>` `#` 프롬프트**: 키커·스트랩라인·섹션 헤더에 코드 주석/프롬프트 기호.
- **계기 리드아웃**: 통계를 둥근 카드 대신 헤어라인으로 나뉜 데이터 스트립(`gap-px bg-border` 트릭)으로.
- **hover 인디케이터**: 테이블 행 hover 시 ID가 앰버로(+ 홈 리스트는 좌측 앰버 바).
- **그리드 텍스처**: 히어로 배경에 `.grid-texture`(헤어라인 격자 + 상단 페이드 마스크).
- **판정/상태**: 성공/실패 = 좌측 컬러 바 + 모노 `PASS`/`FAIL`, 채점 상태 = 컬러 도트 + 모노 라벨(캔디 알약 제거).

## 접근성

- 전역 `:focus-visible` = 소프트 글로우 없는 **크리스프한 앰버 링**(box-shadow 2겹, offset은 `--bg` 연동).
- `aria-current="page"`(네비), `aria-pressed`(AI 필터), 빈 상태 3곳(목록·현황·홈).

## 확장 규칙

1. 새 색 = **토큰인지 시맨틱인지 먼저 판단.** 중립/표면/텍스트 → 토큰. 의미색(상태·티어) → 도메인 배지 컴포넌트 소유(도트+모노).
2. `dark:` 이중 표기·하드코딩 `zinc-*`·헥스 색 신규 도입 금지(기존 시맨틱 배지 예외).
3. 앰버 위 텍스트는 `text-brand-ink`. 라운드는 토큰 스케일에 맡기고 임의 `rounded-2xl` 남발 금지.
4. 구조 UI는 모노, 읽는 글은 Pretendard 원칙 유지.
