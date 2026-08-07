"use client";

/**
 * 디자인 랩 — 홈 시안 (2026-08-06)
 *
 * **본 서비스에는 아직 아무것도 적용하지 않는다.** `/lab` 하위에서만 렌더되고
 * 전역 스타일·컴포넌트를 건드리지 않는다. 의사결정이 끝난 뒤에 본 화면으로 옮긴다.
 * 그래서 네비도 실제 라우트가 아니라 랩 페이지끼리만 오간다.
 *
 * 팔레트·서체·여백은 `theme.ts`의 6축 노브가 결정한다. 우측 하단 조절 패널로
 * 실시간으로 돌려보고, 하단 수치 문자열을 그대로 불러주면 기본값에 고정한다.
 * (2026-07 액센트 색을 정할 때 쓴 방식의 재적용 — 취향은 말로 겨루지 말고 도구로.)
 */

import { useState } from "react";
import LabNav from "./LabNav";
import { buildTheme, DEFAULTS, GREEN, RED, YELLOW, type Knobs } from "./theme";

const PROBLEMS = [
  { id: 4821, title: "우주 정거장의 에코 드론 관리", tier: "SILVER I", rate: 62.4, ai: true },
  { id: 4820, title: "삼색 루미나의 신전", tier: "SILVER III", rate: 48.1, ai: true },
  { id: 4819, title: "포탈 미로 탈출", tier: "GOLD V", rate: 31.7, ai: true },
  { id: 4818, title: "정수 삼각형의 최대 경로", tier: "SILVER I", rate: 57.2, ai: true },
  { id: 4817, title: "창고 적재 순서 정하기", tier: "BRONZE I", rate: 74.9, ai: false },
];

const JUDGING = [
  { id: 4821, lang: "python", color: GREEN, ms: 124 },
  { id: 4820, lang: "java", color: RED, ms: 312 },
  { id: 4819, lang: "node", color: YELLOW, ms: 2000 },
  { id: 4818, lang: "python", color: GREEN, ms: 118 },
];

const PIPELINE = [
  { s: "GENERATE", n: 12 },
  { s: "VALIDATE", n: 8 },
  { s: "JUDGE", n: 5 },
  { s: "REVIEW", n: 3 },
];

export default function LabHomePage() {
  const [k, setK] = useState<Knobs>(DEFAULTS);
  // 로그인 상태를 켜고 끄며 두 화면을 비교하기 위한 랩 전용 스위치.
  // 접근 정책은 이미 확정돼 있다(ADR-0019: 조회·SSE 공개, 제출만 로그인 필수).
  // 여기서 정하는 건 "로그인하면 홈이 달라지는가"뿐이다.
  const [signedIn, setSignedIn] = useState(true);
  const set = (key: keyof Knobs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setK((prev) => ({ ...prev, [key]: Number(e.target.value) }));

  const t = buildTheme(k);
  const { d, labelFont, showPaneBorder, showPaneTitle, showCursor, showPrompts, showLeaders } = t;

  const paneCls = `relative ${showPaneBorder ? "border border-border" : ""}`;
  const panePad = { padding: showPaneBorder ? `${1.4 * d}rem` : 0 };

  const PaneTitle = ({ children }: { children: string }) =>
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
    /* 한 화면 고정 — 페이지는 스크롤하지 않는다(사용자 결정 2026-08-06).
       화면 높이가 제각각이라 '여백을 줄여서 맞추기'는 작은 노트북에서 깨진다.
       대신 상단(네비·스트립·히어로·통계)은 고정 높이로 두고, 남는 높이를
       목록 영역이 흡수하며 넘칠 때만 **패널 안에서** 스크롤한다.
       페인 안에서 내용이 스크롤되는 건 TUI의 기본 동작이기도 하다. */
    <div
      style={t.tokens}
      className={`${t.fontVars} fixed inset-0 z-50 flex flex-col overflow-hidden bg-bg text-fg`}
    >
      <LabNav current="home" d={d} signedIn={signedIn} />

      {/* ── 스트립 — 로그인 여부와 무관하게 **자리는 항상 있다** ────
          내용만 갈린다. 자리를 비우면 로그인 시 레이아웃이 밀려 화면이
          출렁이고, 비로그인 방문자에게는 이 좋은 자리를 그냥 버리는 셈이 된다.

          구조는 양쪽 다 같은 3칸이다 — 상태 / 다음 행동 / 진척:
            로그인   STREAK        이어풀기(막힌 문제)   오늘 진척
            비로그인 오늘 새 문제   오늘의 문제(추천)      로그인 유도
          "다음 행동" 칸이 가운데인 게 핵심이다. 재방문자는 지난번에 막힌 것을,
          첫 방문자는 뭘 풀지를 여기서 바로 집는다. */}
      <div className="shrink-0 border-b border-border bg-elevated/40">
        <div
          className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 text-[12px]"
          style={{ ...labelFont, paddingTop: `${0.6 * d}rem`, paddingBottom: `${0.6 * d}rem` }}
        >
          {signedIn ? (
            <>
              <span className="flex items-baseline gap-2">
                <span className="text-brand">❯</span>
                <span className="text-faint">STREAK</span>
                <span className="tabular-nums text-fg">12</span>
                <span className="text-faint">일</span>
              </span>

              <a href="#" className="group flex items-baseline gap-2">
                <span className="text-faint">이어풀기</span>
                <span className="tabular-nums text-faint">4819</span>
                <span className="text-fg underline decoration-border underline-offset-4 transition-colors group-hover:decoration-brand">
                  포탈 미로 탈출
                </span>
                <span style={{ color: YELLOW }}>TIMEOUT</span>
              </a>

              <span className="ml-auto flex items-baseline gap-2">
                <span className="text-faint">오늘</span>
                <span className="text-[13px] leading-none text-brand">
                  {"█".repeat(3)}
                  <span className="text-border">{"█".repeat(2)}</span>
                </span>
                <span className="tabular-nums text-fg">3</span>
                <span className="text-faint">/ 5</span>
              </span>
            </>
          ) : (
            <>
              <span className="flex items-baseline gap-2">
                <span className="text-brand">❯</span>
                <span className="text-faint">TODAY</span>
                <span className="tabular-nums text-fg">3</span>
                <span className="text-faint">문제 새로 출제</span>
              </span>

              <a href="#" className="group flex items-baseline gap-2">
                <span className="text-faint">오늘의 문제</span>
                <span className="tabular-nums text-faint">4821</span>
                <span className="text-fg underline decoration-border underline-offset-4 transition-colors group-hover:decoration-brand">
                  우주 정거장의 에코 드론 관리
                </span>
                <span className="text-faint">SILVER I</span>
              </a>

              <a
                href="/lab/login"
                className="ml-auto flex items-baseline gap-2 text-faint transition-colors hover:text-fg"
              >
                로그인하면 연속 기록과 이어풀기
                <span className="text-brand">→</span>
              </a>
            </>
          )}
        </div>
      </div>

      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-5 pb-5">
        {/* ── 히어로 ───────────────────────────────────── */}
        <section
          className="relative shrink-0 overflow-hidden"
          style={{ paddingTop: `${4 * d}rem`, paddingBottom: `${4 * d}rem` }}
        >
          <div className="grid-texture pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative">
            <p
              className="mb-6 flex items-center gap-2 text-[12px] tracking-[0.18em]"
              style={labelFont}
            >
              {showPrompts && <span className="text-brand">//</span>}
              <span className="text-faint">
                AI-GENERATED · SIMILARITY-CHECKED · ANSWER-VERIFIED
              </span>
            </p>
            <h1 className="max-w-3xl text-[28px] leading-[1.4] tracking-tight sm:text-[40px] sm:leading-[1.35]">
              매일 새로운 알고리즘 문제를,
              <br />
              <span className="text-brand">AI</span>가 만들고 검증한다.
            </h1>
            <p className="mt-6 max-w-xl text-[14px] leading-[1.9] text-muted">
              {showPrompts && <span className="text-brand">&gt; </span>}
              기존 문제와의 유사도 검증과 N개 독립 풀이 교차검증을 통과한 신선한 문제로
              실전을 준비하세요.
            </p>
            <div className="mt-8 flex flex-wrap gap-2.5 text-[14px]">
              <a
                href="#problems"
                className="inline-flex items-center gap-2 bg-brand text-brand-ink transition-colors hover:bg-brand-hover"
                style={{ padding: `${0.7 * d}rem ${1.2 * d}rem` }}
              >
                문제 풀러 가기 <span>→</span>
              </a>
              <a
                href="/lab/verification"
                className="inline-flex items-center border border-border-strong transition-colors hover:border-brand hover:text-brand"
                style={{ padding: `${0.7 * d}rem ${1.2 * d}rem` }}
              >
                검증 리포트 보기
              </a>
            </div>
          </div>
        </section>

        {/* ── 통계 ─────────────────────────────────────── */}
        <div className={`${paneCls} shrink-0`}>
          <PaneTitle>OVERVIEW</PaneTitle>
          <div
            className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4"
            style={{ margin: showPaneBorder ? `${1.25 * d}rem` : 0 }}
          >
            {[
              { v: "128", l: "PROBLEMS", a: false },
              { v: "120", l: "AI-GENERATED", a: true },
              { v: "92%", l: "VERIFIED", a: false },
              { v: "439K", l: "SUBMISSIONS", a: false },
            ].map((s) => (
              <div key={s.l} className="bg-bg" style={{ padding: `${1.3 * d}rem 1.25rem` }}>
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
        </div>

        {/* ── 문제 목록 + 사이드 ─────────────────────────── */}
        <div
          className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[1fr_296px]"
          style={{ marginTop: `${2.4 * d}rem` }}
        >
          <div className={`${paneCls} flex min-h-0 flex-col`} style={panePad}>
            <PaneTitle>RECENT PROBLEMS</PaneTitle>
            {/* 남는 높이를 흡수하고, 넘칠 때만 이 안에서 스크롤한다 */}
            <ul id="problems" className="-mx-2 min-h-0 flex-1 overflow-y-auto">
              {PROBLEMS.map((p) => (
                <li key={p.id}>
                  <a
                    href="#"
                    className="group flex items-center gap-3 px-2 transition-colors hover:bg-elevated"
                    style={{ paddingTop: `${0.8 * d}rem`, paddingBottom: `${0.8 * d}rem` }}
                  >
                    {showCursor && (
                      <span className="w-3.5 shrink-0 text-brand opacity-0 transition-opacity group-hover:opacity-100">
                        ❯
                      </span>
                    )}
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
                      className="hidden w-28 shrink-0 text-[11px] tracking-[0.12em] text-muted sm:block"
                      style={labelFont}
                    >
                      {p.tier}
                    </span>
                    <span
                      className="w-14 shrink-0 text-right text-[13px] tabular-nums text-muted"
                      style={labelFont}
                    >
                      {p.rate.toFixed(1)}%
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex min-h-0 flex-col gap-6 overflow-y-auto">
            <div className={`${paneCls} shrink-0`} style={panePad}>
              <PaneTitle>JUDGING</PaneTitle>
              <ul className="space-y-3 text-[12px]" style={labelFont}>
                {JUDGING.map((r) => (
                  <li key={r.id} className="flex items-baseline gap-2.5">
                    <span className="tabular-nums text-faint">{r.id}</span>
                    <span className="text-muted">{r.lang}</span>
                    <span className="ml-auto" style={{ color: r.color }}>
                      ●
                    </span>
                    <span className="w-[52px] text-right tabular-nums text-muted">
                      {r.ms}ms
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={`${paneCls} shrink-0`} style={panePad}>
              <PaneTitle>PIPELINE</PaneTitle>
              <ul className="space-y-3 text-[12px]" style={labelFont}>
                {PIPELINE.map((p) => (
                  <li key={p.s} className="flex items-baseline gap-3">
                    <span className="text-muted">{p.s}</span>
                    {showLeaders ? (
                      <span className="flex-1 border-b border-dashed border-border" />
                    ) : (
                      <span className="flex-1" />
                    )}
                    <span className="tabular-nums">{p.n}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] leading-relaxed text-faint">
                검수를 통과하기 전에는 어떤 문제도 게시되지 않습니다.
              </p>
            </div>
          </div>
        </div>
      </main>

      {t.showStatusBar && (
        <footer className="shrink-0 border-t border-border bg-bg/95 backdrop-blur">
          <div
            className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-2 text-[11px]"
            style={labelFont}
          >
            <span className="text-faint">
              JUDGE <span style={{ color: GREEN }}>●</span> 3 RUNNERS
            </span>
            <span className="text-faint">PYTHON · JAVA · JAVASCRIPT</span>
          </div>
        </footer>
      )}

      <ControlPanel
        k={k}
        set={set}
        reset={() => setK(DEFAULTS)}
        readout={`terminal=${k.terminal} density=${k.density} contrast=${k.contrast} warmth=${k.warmth} accent=${k.accent} pixel=${k.pixel}`}
        signedIn={signedIn}
        toggleSignedIn={() => setSignedIn((v) => !v)}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────
 * 조절 패널 — 확정되면 통째로 삭제한다. 시안 토큰에 의존하지 않도록
 * 자체 색을 하드코딩해서 슬라이더가 어떤 값에서도 읽히게 했다.
 * ──────────────────────────────────────────────────── */
const AXES: { key: keyof Knobs; label: string; hint: string }[] = [
  { key: "terminal", label: "TERMINAL", hint: "터미널 어휘의 양" },
  { key: "density", label: "DENSITY", hint: "여백 (낮을수록 빽빽)" },
  { key: "contrast", label: "CONTRAST", hint: "명도 차 (높을수록 쨍함)" },
  { key: "warmth", label: "WARMTH", hint: "웜 바이어스" },
  { key: "accent", label: "ACCENT", hint: "앰버 노출량" },
  { key: "pixel", label: "PIXEL", hint: "비트맵 서체 범위" },
];

function ControlPanel({
  k,
  set,
  reset,
  readout,
  signedIn,
  toggleSignedIn,
}: {
  k: Knobs;
  set: (key: keyof Knobs) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  reset: () => void;
  readout: string;
  signedIn: boolean;
  toggleSignedIn: () => void;
}) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[60] border border-neutral-600 bg-neutral-900 px-3 py-2 font-mono text-[11px] text-neutral-200 shadow-lg"
      >
        ⚙ 조절 패널
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[288px] border border-neutral-700 bg-neutral-900/97 p-4 font-mono text-neutral-200 shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[11px] tracking-[0.18em] text-neutral-400">DESIGN KNOBS</span>
        <button
          onClick={reset}
          className="ml-auto text-[10px] text-neutral-500 hover:text-neutral-200"
        >
          초기화
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-[13px] leading-none text-neutral-500 hover:text-neutral-200"
          aria-label="패널 닫기"
        >
          ×
        </button>
      </div>

      <div className="space-y-3">
        {AXES.map((a) => (
          <label key={a.key} className="block">
            <span className="flex items-baseline gap-2 text-[10px]">
              <span className="text-neutral-300">{a.label}</span>
              <span className="text-neutral-600">{a.hint}</span>
              <span className="ml-auto tabular-nums text-amber-500">{k[a.key]}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={k[a.key]}
              onChange={set(a.key)}
              className="mt-1 w-full accent-amber-500"
            />
          </label>
        ))}
      </div>

      {/* 로그인 상태 — 개인 스트립이 붙은 홈과 공개 홈을 번갈아 본다 */}
      <button
        onClick={toggleSignedIn}
        className="mt-4 flex w-full items-center gap-2 border border-neutral-700 px-2.5 py-2 text-[10px] text-neutral-300 transition-colors hover:border-neutral-500"
      >
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            signedIn ? "bg-amber-500" : "bg-neutral-600"
          }`}
        />
        로그인 상태
        <span className="ml-auto text-neutral-500">
          {signedIn ? "ON — 개인 스트립 표시" : "OFF — 공개 홈"}
        </span>
      </button>

      <div className="mt-3 border-t border-neutral-700 pt-3">
        <div className="mb-1.5 text-[10px] text-neutral-500">이 줄을 그대로 알려주세요</div>
        <code className="block select-all break-all bg-neutral-950 p-2 text-[10px] leading-relaxed text-amber-400">
          {readout}
        </code>
      </div>
      <p className="mt-3 text-[9px] leading-relaxed text-neutral-600">
        이 패널과 /lab 전체는 시안입니다. 본 서비스에는 아직 아무것도 적용하지 않았습니다.
      </p>
    </div>
  );
}
