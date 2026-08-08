/**
 * lab2 테마 — VS Code(Dark Modern) 계열 팔레트 + 우리 시그널 앰버.
 *
 * 이 시안의 전제(2026-08-08 논의, engineering-notes '디자인 재검토'):
 *   **구조적 해법은 VS Code에서 가져오고, 마감은 우리 것을 지킨다.**
 *
 * lab(1차)이 실패한 두 지점을 여기서 뒤집는다:
 *   ① 본문을 웜 크림(#f1e1b8)으로 물들여 브랜드(#d49e68)와 색상각이 13도밖에
 *      안 났다 → 액센트가 액센트로 안 보였다. 여기서는 **본문을 무채색**으로
 *      되돌리고(#cccccc) 브랜드만 채도 100(#ff8a00)으로 둔다.
 *   ② 순수 검정의 할레이션을 '웜'으로 풀다 본문까지 번졌다 → VS Code처럼
 *      **미세한 뉴트럴 리프트**(#1f1f1f)로만 푼다. 색 가족은 건드리지 않는다.
 *
 * 서체는 루트 레이아웃이 이미 로드한 Pretendard(--font-sans)·JetBrains
 * Mono(--font-mono)를 그대로 쓴다. 비트맵(Silkscreen)은 폐기 — 한글 미지원이라
 * 한 줄 안에서 서체가 갈라졌고, 8px 그리드를 임의 크기로 조판해 뭉갰다.
 */

/** Tailwind 토큰은 `R G B` 공백 구분 문자열을 받는다(globals.css와 같은 형식). */
export const TOKENS: Record<string, string> = {
  // 에디터 = 주 캔버스. 크롬보다 **밝다**(VS Code의 명도 방향).
  "--bg": "31 31 31", // #1f1f1f
  // 크롬(타이틀바·액티비티바·사이드바·패널·상태바) — 캔버스보다 어둡게 가라앉힌다.
  "--surface": "24 24 24", // #181818
  // 호버·입력·배지 등 떠오르는 표면.
  "--elevated": "42 42 42", // #2a2a2a
  "--border": "43 43 43", // #2b2b2b
  "--border-strong": "61 61 61", // #3d3d3d
  "--fg": "204 204 204", // #cccccc — **무채색**. 여기가 lab 1차와 갈리는 지점
  "--muted": "157 157 157", // #9d9d9d
  "--faint": "110 110 110", // #6e6e6e
  "--brand": "255 138 0", // #ff8a00 시그널 앰버 — 우리 정체성(VS Code 파랑 대체)
  "--brand-hover": "255 162 46",
  "--brand-ink": "31 31 31",
};

/**
 * 판정·상태 색 — VS Code의 **의미론적** 색을 그대로 쓴다.
 * 장식이 아니라 의미로만 쓰기 때문에 여기서는 브랜드 색과 경쟁하지 않는다
 * (lab 1차의 실패: 앰버를 페인 제목·커서·프롬프트·통계에 장식으로 뿌렸다).
 */
export const PASS = "#73c991"; // testing.iconPassed
export const FAIL = "#f14c4c"; // editorError.foreground
export const WARN = "#cca700"; // editorWarning.foreground
export const INFO = "#3794ff"; // textLink.foreground

/** 티어 색 — 사이드바 트리에서 폴더를 구분하는 최소 신호. */
export const TIER_COLOR: Record<string, string> = {
  BRONZE: "#b08d57",
  SILVER: "#a8a8a8",
  GOLD: "#d4af37",
};

/** 셰브론 등 구조 아이콘의 기본 색 — 내용이 아니라 뼈대라 가장 흐리게. */
export const MUTED_ICON = "text-faint";

/** 사이드바 폭 = clamp(하한, 저장된 비율, 상한).
 *  비율로 저장하는 이유와 하한이 필요한 이유는 workspace.tsx 주석 참조
 *  (하한 아래로는 문제 제목이 잘려서 목록의 쓸모가 사라진다). */
export const SIDEBAR_MIN_PX = 200;
export const SIDEBAR_MAX_PX = 480;

export function sidebarWidth(ratio: number, viewportPx: number): number {
  return Math.round(Math.min(SIDEBAR_MAX_PX, Math.max(SIDEBAR_MIN_PX, ratio * viewportPx)));
}
