/**
 * 디자인 랩 — 마이페이지 시안 (2026-08-06)
 *
 * **본 서비스에는 아직 적용하지 않는다.** `/lab` 하위 시안이다.
 *
 * 홈에서 뺀 개인 지표(활동 스파크라인·언어 분포·난이도 분포)의 거처.
 * 홈은 "이 서비스가 무엇인가"를 말하는 자리고, 이런 건 "내가 어떻게 하고 있나"라
 * 성격이 다르다.
 *
 * 블록 문자(▁▂▃▄▅▆▇█)로 그래프를 그린 것은 장식이 아니라 이 디자인 언어의
 * 연장이다 — 터미널에서 히스토그램을 그리는 관용적 방법이고, 픽셀 서체·모노
 * 그리드와 같은 격자 위에 얹힌다. SVG 차트를 쓰면 화면에서 혼자 이질적이 된다.
 */

import LabNav from "../LabNav";
import { buildTheme, DEFAULTS, GREEN, RED, YELLOW } from "../theme";

const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

/** 최근 30일 제출량 — 0이면 공백으로 두어 '쉰 날'이 드러나게 한다. */
const DAILY = [
  3, 5, 0, 8, 12, 7, 4, 0, 0, 6, 9, 14, 11, 5, 2, 0, 7, 10, 13, 8, 4, 0, 0, 3, 9,
  15, 12, 6, 8, 11,
];

const LANGS = [
  { name: "python", solved: 82, rate: 64.2 },
  { name: "java", solved: 31, rate: 51.6 },
  { name: "javascript", solved: 14, rate: 42.9 },
];

const TIERS = [
  { name: "BRONZE", solved: 34, total: 38 },
  { name: "SILVER", solved: 61, total: 74 },
  { name: "GOLD", solved: 27, total: 52 },
  { name: "PLATINUM", solved: 5, total: 21 },
];

const HISTORY = [
  { id: 4821, title: "우주 정거장의 에코 드론 관리", lang: "python", color: GREEN, label: "ACCEPTED", when: "10분 전" },
  { id: 4820, title: "삼색 루미나의 신전", lang: "java", color: RED, label: "WRONG", when: "42분 전" },
  { id: 4819, title: "포탈 미로 탈출", lang: "node", color: YELLOW, label: "TIMEOUT", when: "1시간 전" },
  { id: 4818, title: "정수 삼각형의 최대 경로", lang: "python", color: GREEN, label: "ACCEPTED", when: "3시간 전" },
  { id: 4816, title: "물류 로봇의 최소 회전", lang: "python", color: GREEN, label: "ACCEPTED", when: "어제" },
];

export default function LabMyPage() {
  const t = buildTheme(DEFAULTS);
  const { d, labelFont, showPaneBorder, showPaneTitle, showPrompts, showLeaders } = t;

  const paneCls = `relative ${showPaneBorder ? "border border-border" : ""}`;
  const panePad = { padding: showPaneBorder ? `${1.4 * d}rem` : 0 };
  const peak = Math.max(...DAILY);

  const Title = ({ children }: { children: string }) =>
    showPaneTitle ? (
      <span
        className="absolute -top-[7px] left-4 bg-bg px-2 text-[11px] tracking-[0.18em] text-brand"
        style={labelFont}
      >
        {children}
      </span>
    ) : (
      <h2 className="mb-4 text-[12px] tracking-[0.18em]" style={labelFont}>
        {children}
      </h2>
    );

  return (
    <div
      style={t.tokens}
      className={`${t.fontVars} fixed inset-0 z-50 overflow-y-auto bg-bg text-fg`}
    >
      <LabNav current="me" d={d} />

      <main className="mx-auto max-w-6xl px-5" style={{ paddingBottom: `${3 * d}rem` }}>
        {/* ── 표제 ─────────────────────────────────────── */}
        <section style={{ paddingTop: `${3 * d}rem`, paddingBottom: `${2.2 * d}rem` }}>
          <p
            className="mb-4 flex items-center gap-2 text-[11px] tracking-[0.18em] text-faint"
            style={labelFont}
          >
            {showPrompts && <span className="text-brand">//</span>}
            MY ACTIVITY
          </p>
          <h1 className="text-[24px] leading-snug tracking-tight sm:text-[30px]">
            @rlatkd
          </h1>
          <div className="mt-5 grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
            {[
              { v: "127", l: "SOLVED", a: true },
              { v: "248", l: "SUBMITS", a: false },
              { v: "51.2%", l: "ACCEPTED", a: false },
              { v: "12", l: "STREAK", a: false },
            ].map((s) => (
              <div key={s.l} className="bg-bg" style={{ padding: `${1.2 * d}rem 1.25rem` }}>
                <div
                  className={`text-[26px] tabular-nums leading-none tracking-tight ${
                    s.a ? "text-brand" : ""
                  }`}
                  style={labelFont}
                >
                  {s.v}
                </div>
                <div
                  className="mt-2.5 text-[11px] tracking-[0.18em] text-faint"
                  style={labelFont}
                >
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 활동 스파크라인 ────────────────────────────── */}
        <div className={paneCls} style={panePad}>
          <Title>ACTIVITY · 30D</Title>
          <div className="overflow-x-auto">
            <div
              className="whitespace-nowrap text-[26px] leading-none tracking-[0.12em] text-brand"
              style={labelFont}
              aria-label="최근 30일 일별 제출량"
            >
              {DAILY.map((n, i) => (
                <span key={i} style={{ opacity: n === 0 ? 0.22 : 0.55 + (n / peak) * 0.45 }}>
                  {n === 0 ? "·" : BLOCKS[Math.min(7, Math.floor((n / peak) * 7))]}
                </span>
              ))}
            </div>
          </div>
          <div
            className="mt-3 flex items-baseline gap-4 text-[11px] text-faint"
            style={labelFont}
          >
            <span>30일 전</span>
            {showLeaders && <span className="flex-1 border-b border-dashed border-border" />}
            <span>
              최다 <span className="text-fg">{peak}</span>건 · 쉰 날{" "}
              <span className="text-fg">{DAILY.filter((n) => n === 0).length}</span>일
            </span>
            <span>오늘</span>
          </div>
        </div>

        {/* ── 언어 · 난이도 ─────────────────────────────── */}
        <div
          className="grid gap-6 lg:grid-cols-2"
          style={{ marginTop: `${2.6 * d}rem` }}
        >
          <div className={paneCls} style={panePad}>
            <Title>BY LANGUAGE</Title>
            <ul className="space-y-4">
              {LANGS.map((l) => (
                <li key={l.name}>
                  <div
                    className="flex items-baseline gap-3 text-[12px]"
                    style={labelFont}
                  >
                    <span className="w-20 text-muted">{l.name}</span>
                    <span className="tabular-nums text-fg">{l.solved}</span>
                    <span className="ml-auto tabular-nums text-faint">{l.rate}%</span>
                  </div>
                  <div
                    className="mt-1.5 overflow-hidden whitespace-nowrap text-[13px] leading-none text-brand"
                    style={labelFont}
                  >
                    {"█".repeat(Math.round(l.rate / 4))}
                    <span className="text-border">
                      {"█".repeat(25 - Math.round(l.rate / 4))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className={paneCls} style={panePad}>
            <Title>BY TIER</Title>
            <ul className="space-y-4">
              {TIERS.map((t2) => {
                const pct = Math.round((t2.solved / t2.total) * 100);
                return (
                  <li key={t2.name}>
                    <div
                      className="flex items-baseline gap-3 text-[12px]"
                      style={labelFont}
                    >
                      <span className="w-20 text-muted">{t2.name}</span>
                      <span className="tabular-nums text-fg">
                        {t2.solved}
                        <span className="text-faint">/{t2.total}</span>
                      </span>
                      <span className="ml-auto tabular-nums text-faint">{pct}%</span>
                    </div>
                    <div
                      className="mt-1.5 overflow-hidden whitespace-nowrap text-[13px] leading-none text-brand"
                      style={labelFont}
                    >
                      {"█".repeat(Math.round(pct / 4))}
                      <span className="text-border">
                        {"█".repeat(25 - Math.round(pct / 4))}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* ── 최근 제출 ─────────────────────────────────── */}
        <div className={paneCls} style={{ ...panePad, marginTop: `${2.6 * d}rem` }}>
          <Title>RECENT SUBMISSIONS</Title>
          <ul className="-mx-2">
            {HISTORY.map((h) => (
              <li key={h.id}>
                <a
                  href="#"
                  className="group flex items-center gap-3 px-2 transition-colors hover:bg-elevated"
                  style={{ paddingTop: `${0.75 * d}rem`, paddingBottom: `${0.75 * d}rem` }}
                >
                  <span style={{ color: h.color }}>●</span>
                  <span
                    className="w-14 shrink-0 text-[13px] tabular-nums text-faint"
                    style={labelFont}
                  >
                    {h.id}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px]">{h.title}</span>
                  <span
                    className="hidden w-20 shrink-0 text-[11px] text-faint sm:block"
                    style={labelFont}
                  >
                    {h.lang}
                  </span>
                  <span
                    className="w-20 shrink-0 text-right text-[11px] tracking-[0.12em]"
                    style={{ ...labelFont, color: h.color }}
                  >
                    {h.label}
                  </span>
                  <span
                    className="hidden w-16 shrink-0 text-right text-[11px] text-faint sm:block"
                    style={labelFont}
                  >
                    {h.when}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </main>

      {t.showStatusBar && (
        <footer className="sticky bottom-0 border-t border-border bg-bg/95 backdrop-blur">
          <div
            className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-2 text-[11px]"
            style={labelFont}
          >
            <span className="text-faint">
              STREAK <span style={{ color: GREEN }}>●</span> 12 DAYS
            </span>
            <span className="text-faint">SOLVED 127 / 185</span>
            <a href="/lab" className="ml-auto text-faint transition-colors hover:text-fg">
              ← HOME
            </a>
          </div>
        </footer>
      )}
    </div>
  );
}
