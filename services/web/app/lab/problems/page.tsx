/**
 * 디자인 랩 — 문제 목록 시안 (2026-08-06)
 *
 * **본 서비스에는 아직 적용하지 않는다.** `/lab` 하위 시안이다.
 *
 * 본 서비스의 `/problems`에 대응한다. 이 화면의 일은 "고르게 하는 것"이라
 * 필터가 화면의 주인공이다. 터미널 언어로는 필터가 **플래그**로 읽힌다 —
 * 그래서 선택된 필터를 `--tier=silver --tag=bfs` 형태의 쿼리 줄로 되비쳐 준다.
 * 장식이 아니라, 지금 무엇으로 걸러진 목록인지 한 줄로 확인시키는 장치다.
 */

import LabNav from "../LabNav";
import { buildTheme, DEFAULTS } from "../theme";

const TIERS = ["ALL", "BRONZE", "SILVER", "GOLD", "PLATINUM"];
const TAGS = ["ALL", "BFS", "DP", "GREEDY", "GRAPH", "SORT", "IMPLEMENTATION"];

const PROBLEMS = [
  { id: 4821, title: "우주 정거장의 에코 드론 관리", tier: "SILVER I", tags: "BFS · SIMULATION", rate: 62.4, submits: 1240, ai: true, solved: true },
  { id: 4820, title: "삼색 루미나의 신전", tier: "SILVER III", tags: "BFS · GRAPH", rate: 48.1, submits: 872, ai: true, solved: false },
  { id: 4819, title: "포탈 미로 탈출", tier: "GOLD V", tags: "BFS · SHORTEST PATH", rate: 31.7, submits: 654, ai: true, solved: false },
  { id: 4818, title: "정수 삼각형의 최대 경로", tier: "SILVER I", tags: "DP", rate: 57.2, submits: 1103, ai: true, solved: true },
  { id: 4817, title: "창고 적재 순서 정하기", tier: "BRONZE I", tags: "GREEDY · SORT", rate: 74.9, submits: 2018, ai: false, solved: true },
  { id: 4816, title: "물류 로봇의 최소 회전", tier: "GOLD IV", tags: "BFS · DP", rate: 28.3, submits: 421, ai: true, solved: false },
  { id: 4815, title: "관측소 신호 정렬", tier: "SILVER II", tags: "SORT · IMPLEMENTATION", rate: 66.0, submits: 1590, ai: true, solved: false },
  { id: 4814, title: "광물 채굴 스케줄", tier: "GOLD III", tags: "GREEDY · DP", rate: 22.8, submits: 305, ai: true, solved: false },
];

export default function LabProblemsPage() {
  const t = buildTheme(DEFAULTS);
  const { d, labelFont, showPaneBorder, showPaneTitle, showCursor, showPrompts } = t;

  const paneCls = `relative ${showPaneBorder ? "border border-border" : ""}`;
  const panePad = { padding: showPaneBorder ? `${1.4 * d}rem` : 0 };

  return (
    <div
      style={t.tokens}
      className={`${t.fontVars} fixed inset-0 z-50 overflow-y-auto bg-bg text-fg`}
    >
      <LabNav current="problems" d={d} />

      <main className="mx-auto max-w-6xl px-5" style={{ paddingBottom: `${3 * d}rem` }}>
        <section style={{ paddingTop: `${2.6 * d}rem`, paddingBottom: `${1.8 * d}rem` }}>
          <p
            className="mb-3 flex items-center gap-2 text-[11px] tracking-[0.18em] text-faint"
            style={labelFont}
          >
            {showPrompts && <span className="text-brand">//</span>}
            PROBLEMS
          </p>
          <h1 className="text-[24px] leading-snug tracking-tight sm:text-[28px]">
            128개 문제 · <span className="text-brand">120개</span>가 AI 생성
          </h1>
        </section>

        {/* ── 필터 ─────────────────────────────────────
            선택 상태를 쿼리 줄로 되비쳐 "지금 무엇으로 걸러졌나"를 한 줄로 보여준다. */}
        <div className={paneCls} style={panePad}>
          {showPaneTitle ? (
            <span
              className="absolute -top-[7px] left-4 bg-bg px-2 text-[11px] tracking-[0.18em] text-brand"
              style={labelFont}
            >
              FILTER
            </span>
          ) : (
            <h2 className="mb-4 text-[12px] tracking-[0.18em]" style={labelFont}>
              FILTER
            </h2>
          )}

          <div className="space-y-3">
            <FilterRow label="TIER" items={TIERS} active="SILVER" labelFont={labelFont} />
            <FilterRow label="TAG" items={TAGS} active="BFS" labelFont={labelFont} />
            <div className="flex items-baseline gap-3">
              <span
                className="w-12 shrink-0 text-[10px] tracking-[0.16em] text-faint"
                style={labelFont}
              >
                FLAG
              </span>
              <div className="flex flex-wrap gap-1.5">
                <Chip active label="AI-ONLY" labelFont={labelFont} />
                <Chip label="UNSOLVED" labelFont={labelFont} />
              </div>
            </div>
          </div>

          <div
            className="mt-4 flex items-baseline gap-2 border-t border-border pt-3 text-[11px]"
            style={labelFont}
          >
            <span className="text-brand">$</span>
            <span className="text-muted">
              problems <span className="text-fg">--tier=silver --tag=bfs --ai-only</span>
            </span>
            <span className="ml-auto text-faint">3 / 128 matched</span>
          </div>
        </div>

        {/* ── 목록 ─────────────────────────────────────── */}
        <div className={paneCls} style={{ ...panePad, marginTop: `${2.2 * d}rem` }}>
          {showPaneTitle ? (
            <span
              className="absolute -top-[7px] left-4 bg-bg px-2 text-[11px] tracking-[0.18em] text-brand"
              style={labelFont}
            >
              RESULTS
            </span>
          ) : (
            <h2 className="mb-4 text-[12px] tracking-[0.18em]" style={labelFont}>
              RESULTS
            </h2>
          )}

          <div
            className="flex items-center gap-3 border-b border-border pb-2 text-[10px] tracking-[0.16em] text-faint"
            style={labelFont}
          >
            {showCursor && <span className="w-3.5 shrink-0" />}
            <span className="w-6 shrink-0" />
            <span className="w-14 shrink-0">ID</span>
            <span className="min-w-0 flex-1">TITLE</span>
            <span className="hidden w-40 shrink-0 sm:block">TAGS</span>
            <span className="hidden w-24 shrink-0 sm:block">TIER</span>
            <span className="w-16 shrink-0 text-right">RATE</span>
          </div>

          <ul className="-mx-2">
            {PROBLEMS.map((p) => (
              <li key={p.id}>
                <a
                  href="#"
                  className="group flex items-center gap-3 border-b border-border px-2 transition-colors hover:bg-elevated"
                  style={{ paddingTop: `${0.75 * d}rem`, paddingBottom: `${0.75 * d}rem` }}
                >
                  {showCursor && (
                    <span className="w-3.5 shrink-0 text-brand opacity-0 transition-opacity group-hover:opacity-100">
                      ❯
                    </span>
                  )}
                  {/* 해결 여부 — 색 알약 대신 체크 문자 하나 */}
                  <span
                    className="w-6 shrink-0 text-[12px]"
                    style={{ ...labelFont, color: p.solved ? "#b8bb26" : undefined }}
                  >
                    {p.solved ? "✓" : ""}
                  </span>
                  <span
                    className="w-14 shrink-0 text-[13px] tabular-nums text-faint transition-colors group-hover:text-brand"
                    style={labelFont}
                  >
                    {p.id}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px]">
                    {p.title}
                    {p.ai && (
                      <span
                        className="ml-2.5 align-middle text-[10px] tracking-[0.18em] text-faint"
                        style={labelFont}
                      >
                        AI
                      </span>
                    )}
                  </span>
                  <span
                    className="hidden w-40 shrink-0 truncate text-[11px] tracking-[0.1em] text-faint sm:block"
                    style={labelFont}
                  >
                    {p.tags}
                  </span>
                  <span
                    className="hidden w-24 shrink-0 text-[11px] tracking-[0.12em] text-muted sm:block"
                    style={labelFont}
                  >
                    {p.tier}
                  </span>
                  <span
                    className="w-16 shrink-0 text-right text-[13px] tabular-nums text-muted"
                    style={labelFont}
                  >
                    {p.rate.toFixed(1)}%
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <div
            className="flex items-center gap-3 pt-3 text-[11px] text-faint"
            style={labelFont}
          >
            <span>1–8 of 128</span>
            <span className="ml-auto flex gap-3">
              <span className="text-border">← PREV</span>
              <a href="#" className="transition-colors hover:text-fg">
                NEXT →
              </a>
            </span>
          </div>
        </div>
      </main>

      {t.showStatusBar && (
        <footer className="sticky bottom-0 border-t border-border bg-bg/95 backdrop-blur">
          <div
            className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-2 text-[11px]"
            style={labelFont}
          >
            <span className="text-faint">128 PROBLEMS</span>
            <span className="text-faint">94% AI-GENERATED</span>
            <a href="/lab" className="ml-auto text-faint transition-colors hover:text-fg">
              ← HOME
            </a>
          </div>
        </footer>
      )}
    </div>
  );
}

function FilterRow({
  label,
  items,
  active,
  labelFont,
}: {
  label: string;
  items: string[];
  active: string;
  labelFont?: React.CSSProperties;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span
        className="w-12 shrink-0 text-[10px] tracking-[0.16em] text-faint"
        style={labelFont}
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <Chip key={i} label={i} active={i === active} labelFont={labelFont} />
        ))}
      </div>
    </div>
  );
}

function Chip({
  label,
  active = false,
  labelFont,
}: {
  label: string;
  active?: boolean;
  labelFont?: React.CSSProperties;
}) {
  return (
    <button
      className={`border px-2.5 py-1 text-[10px] tracking-[0.14em] transition-colors ${
        active
          ? "border-brand text-brand"
          : "border-border text-faint hover:border-border-strong hover:text-muted"
      }`}
      style={labelFont}
    >
      {label}
    </button>
  );
}
