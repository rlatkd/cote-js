import type { Config } from "tailwindcss";

// 색 값은 globals.css의 CSS 변수(:root/.dark)가 소유한다.
// 여기선 시맨틱 이름 → 변수 매핑만 한다. <alpha-value>로 투명도 유틸 지원.
const withAlpha = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./views/**/*.{js,ts,jsx,tsx,mdx}",
    "./entities/**/*.{js,ts,jsx,tsx,mdx}",
    "./shared/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: withAlpha("--bg"),
        surface: withAlpha("--surface"),
        elevated: withAlpha("--elevated"),
        border: withAlpha("--border"),
        "border-strong": withAlpha("--border-strong"),
        fg: withAlpha("--fg"),
        muted: withAlpha("--muted"),
        faint: withAlpha("--faint"),
        brand: {
          DEFAULT: withAlpha("--brand"),
          hover: withAlpha("--brand-hover"),
          ink: withAlpha("--brand-ink"),
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      // "Instrument" 기하 — 각지고 정밀하게. 라운드 최소화, 도트/원만 full 유지.
      borderRadius: {
        none: "0",
        sm: "1px",
        DEFAULT: "2px",
        md: "2px",
        lg: "2px",
        xl: "3px",
        "2xl": "4px",
        "3xl": "6px",
        full: "9999px",
      },
      transitionTimingFunction: {
        DEFAULT: "var(--ease-soft)",
        soft: "var(--ease-soft)",
      },
      transitionDuration: {
        DEFAULT: "140ms",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s var(--ease-soft) both",
        blink: "blink 1.1s steps(1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
