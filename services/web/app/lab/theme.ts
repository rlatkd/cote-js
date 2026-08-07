/**
 * 디자인 랩 공통 테마 — `/lab` 하위 페이지들이 공유한다.
 *
 * 랩 전용이며 전역 스타일(globals.css)은 건드리지 않는다. 채택되면 여기 값이
 * globals.css의 다크 팔레트로 옮겨간다.
 *
 * 6축 노브가 각각 조절하는 것:
 *   TERMINAL — 터미널 어휘의 양(상태바 → 페인 테두리 → 제목 인셋·커서 → 프롬프트 기호)
 *   DENSITY  — 여백 배율. 낮을수록 빽빽하다
 *   CONTRAST — 배경과 본문의 명도 차. 높을수록 쨍하고 눈이 피로하다
 *   WARMTH   — 뉴트럴의 웜 바이어스. 0=중성 회색, 100=Gruvbox 계열 웜
 *   ACCENT   — 앰버의 노출량과 강도
 *   PIXEL    — 비트맵 서체 적용 범위(없음 → 라벨·숫자만 → 전체)
 */

import { JetBrains_Mono, Silkscreen } from "next/font/google";

export const pixelFont = Silkscreen({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-pixel",
});

export const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-mono-lab",
});

export type Knobs = {
  terminal: number;
  density: number;
  contrast: number;
  warmth: number;
  accent: number;
  pixel: number;
};

/** 사용자가 슬라이더로 찾은 조합 (2026-08-06). */
export const DEFAULTS: Knobs = {
  terminal: 65,
  density: 0,
  contrast: 70,
  warmth: 100,
  accent: 0,
  pixel: 55,
};

/** 판정·상태 색 — 배색 계열에서 골라 화면이 따로 놀지 않게 한다. */
export const GREEN = "#b8bb26";
export const RED = "#fb4934";
export const YELLOW = "#fabd2f";

type RGB = [number, number, number];

const NEUTRAL: Record<string, RGB> = {
  bg: [22, 22, 22],
  surface: [32, 32, 32],
  elevated: [42, 42, 42],
  border: [62, 62, 62],
  borderStrong: [104, 104, 104],
  fg: [234, 234, 234],
  muted: [166, 166, 166],
  faint: [116, 116, 116],
  brand: [255, 138, 0],
};

const WARM: Record<string, RGB> = {
  bg: [35, 33, 32],
  surface: [40, 40, 40],
  elevated: [50, 48, 44],
  border: [78, 71, 67],
  borderStrong: [124, 111, 100],
  fg: [235, 219, 178],
  muted: [189, 174, 147],
  faint: [146, 131, 116],
  brand: [254, 128, 25],
};

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const mix = (a: RGB, b: RGB, t: number): RGB =>
  [0, 1, 2].map((i) => clamp(a[i] + (b[i] - a[i]) * t)) as RGB;
const shift = (c: RGB, delta: number): RGB =>
  [0, 1, 2].map((i) => clamp(c[i] + delta)) as RGB;
const str = (c: RGB) => `${c[0]} ${c[1]} ${c[2]}`;

export function buildTheme(k: Knobs) {
  const w = k.warmth / 100;
  const cDelta = (k.contrast - 50) / 50;
  const p = (key: string) => mix(NEUTRAL[key], WARM[key], w);

  const bg = shift(p("bg"), -cDelta * 14);
  const fg = shift(p("fg"), cDelta * 16);
  // 액센트가 낮으면 브랜드색을 뉴트럴 쪽으로 끌어당겨 존재감을 줄인다
  const brand = mix(p("muted"), p("brand"), 0.35 + (k.accent / 100) * 0.65);

  const monoStack = "var(--font-mono-lab), var(--font-sans), monospace";
  const pixelStack = `var(--font-pixel), ${monoStack}`;
  const pixelAll = k.pixel >= 66;
  const pixelLabels = k.pixel >= 33;

  return {
    tokens: {
      "--bg": str(bg),
      "--surface": str(p("surface")),
      "--elevated": str(p("elevated")),
      "--border": str(p("border")),
      "--border-strong": str(p("borderStrong")),
      "--fg": str(fg),
      "--muted": str(p("muted")),
      "--faint": str(p("faint")),
      "--brand": str(brand),
      "--brand-hover": str(shift(brand, 26)),
      "--brand-ink": str(bg),
      fontFamily: pixelAll ? pixelStack : monoStack,
    } as React.CSSProperties,

    /** 여백 배율 0.65 ~ 1.5 */
    d: 0.65 + (k.density / 100) * 0.85,

    /** 라벨·수치용 서체 — PIXEL이 중간 단계면 여기만 픽셀. */
    labelFont: pixelLabels ? ({ fontFamily: pixelStack } as React.CSSProperties) : undefined,

    showStatusBar: k.terminal >= 15,
    showPaneBorder: k.terminal >= 35,
    showPaneTitle: k.terminal >= 55,
    showCursor: k.terminal >= 55,
    showPrompts: k.terminal >= 75,
    showLeaders: k.terminal >= 75,

    fontVars: `${pixelFont.variable} ${monoFont.variable}`,
  };
}
