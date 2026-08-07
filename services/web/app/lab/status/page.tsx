/**
 * 디자인 랩 — 채점 현황 시안 (2026-08-06)
 *
 * **본 서비스에는 아직 적용하지 않는다.** `/lab` 하위 시안이다.
 *
 * 본 서비스의 `/status`에 대응한다. 이 화면은 **흐르는 화면**이다 —
 * SSE로 결과가 실시간으로 꽂히는 자리라, 정적인 표가 아니라 로그 뷰의 성격이
 * 강하다. 그래서 터미널 언어가 가장 자연스럽게 맞는 화면이기도 하다.
 *
 * 케이스별 진행을 블록으로 그린 건(`████░`) 실제로 우리가 케이스 단위 결과를
 * 저장·전송하기 때문이다(submission_case). 없는 정보를 그린 게 아니다.
 */

import LabNav from "../LabNav";
import { buildTheme, DEFAULTS, GREEN, RED, YELLOW } from "../theme";

type Row = {
  id: number;
  user: string;
  problem: string;
  lang: string;
  verdict: string;
  color?: string;
  cases: [number, number]; // [통과, 전체]
  ms: number | null;
  mb: number | null;
  when: string;
  running?: boolean;
};

const ROWS: Row[] = [
  { id: 4831, user: "rlatkd", problem: "우주 정거장의 에코 드론 관리", lang: "python", verdict: "채점 중", cases: [3, 5], ms: null, mb: null, when: "방금", running: true },
  { id: 4830, user: "hyunwoo", problem: "포탈 미로 탈출", lang: "java", verdict: "맞았습니다", color: GREEN, cases: [5, 5], ms: 284, mb: 41.2, when: "12초 전" },
  { id: 4829, user: "jiwon", problem: "삼색 루미나의 신전", lang: "python", verdict: "틀렸습니다", color: RED, cases: [2, 5], ms: 96, mb: 9.4, when: "38초 전" },
  { id: 4828, user: "rlatkd", problem: "물류 로봇의 최소 회전", lang: "node", verdict: "시간 초과", color: YELLOW, cases: [4, 5], ms: 2000, mb: 31.7, when: "1분 전" },
  { id: 4827, user: "sunho", problem: "정수 삼각형의 최대 경로", lang: "python", verdict: "맞았습니다", color: GREEN, cases: [5, 5], ms: 118, mb: 9.1, when: "2분 전" },
  { id: 4826, user: "minji", problem: "창고 적재 순서 정하기", lang: "java", verdict: "맞았습니다", color: GREEN, cases: [5, 5], ms: 301, mb: 40.8, when: "3분 전" },
  { id: 4825, user: "jiwon", problem: "관측소 신호 정렬", lang: "python", verdict: "컴파일 에러", color: RED, cases: [0, 5], ms: null, mb: null, when: "4분 전" },
];

export default function LabStatusPage() {
  const t = buildTheme(DEFAULTS);
  const { d, labelFont, showPaneBorder, showPaneTitle, showPrompts } = t;

  const paneCls = `relative ${showPaneBorder ? "border border-border" : ""}`;
  const panePad = { padding: showPaneBorder ? `${1.4 * d}rem` : 0 };

  return (
    <div
      style={t.tokens}
      className={`${t.fontVars} fixed inset-0 z-50 overflow-y-auto bg-bg text-fg`}
    >
      <LabNav current="status" d={d} />

      <main className="mx-auto max-w-6xl px-5" style={{ paddingBottom: `${3 * d}rem` }}>
        <section style={{ paddingTop: `${2.6 * d}rem`, paddingBottom: `${1.8 * d}rem` }}>
          <p
            className="mb-3 flex items-center gap-2 text-[11px] tracking-[0.18em] text-faint"
            style={labelFont}
          >
            {showPrompts && <span className="text-brand">//</span>}
            JUDGE STATUS
          </p>
          <h1 className="flex flex-wrap items-baseline gap-x-3 text-[24px] leading-snug tracking-tight sm:text-[28px]">
            <span>채점 현황</span>
            <span className="flex items-center gap-2 text-[13px] text-faint">
              <span
                className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                style={{ background: GREEN }}
              />
              실시간 연결됨
            </span>
          </h1>
        </section>

        {/* ── 러너 상태 ────────────────────────────────── */}
        <div className={paneCls} style={panePad}>
          {showPaneTitle ? (
            <span
              className="absolute -top-[7px] left-4 bg-bg px-2 text-[11px] tracking-[0.18em] text-brand"
              style={labelFont}
            >
              RUNNERS
            </span>
          ) : (
            <h2 className="mb-4 text-[12px] tracking-[0.18em]" style={labelFont}>
              RUNNERS
            </h2>
          )}
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
            {[
              { l: "RUN LANE", v: "2", s: "슬롯 2 / 2" },
              { l: "SUBMIT LANE", v: "1", s: "슬롯 2 중 1" },
              { l: "BATCH LANE", v: "1", s: "검증 트래픽" },
              { l: "AVG", v: "0.9s", s: "최근 100건" },
            ].map((r) => (
              <div key={r.l} className="bg-bg" style={{ padding: `${1.1 * d}rem 1.25rem` }}>
                <div
                  className="text-[10px] tracking-[0.16em] text-faint"
                  style={labelFont}
                >
                  {r.l}
                </div>
                <div className="mt-2 text-[22px] tabular-nums leading-none" style={labelFont}>
                  {r.v}
                </div>
                <div className="mt-1.5 text-[11px] text-faint">{r.s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 제출 스트림 ──────────────────────────────── */}
        <div className={paneCls} style={{ ...panePad, marginTop: `${2.2 * d}rem` }}>
          {showPaneTitle ? (
            <span
              className="absolute -top-[7px] left-4 bg-bg px-2 text-[11px] tracking-[0.18em] text-brand"
              style={labelFont}
            >
              SUBMISSIONS
            </span>
          ) : (
            <h2 className="mb-4 text-[12px] tracking-[0.18em]" style={labelFont}>
              SUBMISSIONS
            </h2>
          )}

          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div
                className="flex items-center gap-3 border-b border-border pb-2 text-[10px] tracking-[0.16em] text-faint"
                style={labelFont}
              >
                <span className="w-14 shrink-0">ID</span>
                <span className="w-20 shrink-0">USER</span>
                <span className="min-w-0 flex-1">PROBLEM</span>
                <span className="w-16 shrink-0">LANG</span>
                <span className="w-24 shrink-0">CASES</span>
                <span className="w-24 shrink-0">VERDICT</span>
                <span className="w-16 shrink-0 text-right">TIME</span>
                <span className="w-16 shrink-0 text-right">MEM</span>
              </div>

              <ul>
                {ROWS.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 border-b border-border"
                    style={{ paddingTop: `${0.7 * d}rem`, paddingBottom: `${0.7 * d}rem` }}
                  >
                    <span
                      className="w-14 shrink-0 text-[13px] tabular-nums text-faint"
                      style={labelFont}
                    >
                      {r.id}
                    </span>
                    <span
                      className="w-20 shrink-0 truncate text-[12px] text-muted"
                      style={labelFont}
                    >
                      {r.user}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px]">{r.problem}</span>
                    <span
                      className="w-16 shrink-0 text-[11px] text-faint"
                      style={labelFont}
                    >
                      {r.lang}
                    </span>
                    {/* 케이스 진행 — 실제로 케이스 단위 결과를 저장하기에 그릴 수 있는 정보 */}
                    <span
                      className="w-24 shrink-0 text-[12px] leading-none"
                      style={{ ...labelFont, color: r.running ? "rgb(var(--brand))" : r.color }}
                      title={`${r.cases[0]} / ${r.cases[1]} 통과`}
                    >
                      {"█".repeat(r.cases[0])}
                      <span className="text-border">
                        {"█".repeat(r.cases[1] - r.cases[0])}
                      </span>
                      <span className="ml-1.5 text-[10px] tabular-nums text-faint">
                        {r.cases[0]}/{r.cases[1]}
                      </span>
                    </span>
                    <span
                      className="flex w-24 shrink-0 items-center gap-1.5 text-[12px]"
                      style={{ ...labelFont, color: r.color }}
                    >
                      {r.running && (
                        <span className="inline-block h-[11px] w-[6px] animate-blink bg-brand" />
                      )}
                      {r.verdict}
                    </span>
                    <span
                      className="w-16 shrink-0 text-right text-[12px] tabular-nums text-muted"
                      style={labelFont}
                    >
                      {r.ms === null ? "—" : `${r.ms}ms`}
                    </span>
                    <span
                      className="w-16 shrink-0 text-right text-[12px] tabular-nums text-muted"
                      style={labelFont}
                    >
                      {r.mb === null ? "—" : `${r.mb}MB`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-faint">
            결과는 채점기가 발행하는 즉시 밀려옵니다. 새로고침하지 않아도 갱신됩니다.
          </p>
        </div>
      </main>

      {t.showStatusBar && (
        <footer className="sticky bottom-0 border-t border-border bg-bg/95 backdrop-blur">
          <div
            className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-2 text-[11px]"
            style={labelFont}
          >
            <span className="text-faint">
              JUDGE <span style={{ color: GREEN }}>●</span> 3 RUNNERS
            </span>
            <span className="text-faint">QUEUE 1</span>
            <a href="/lab" className="ml-auto text-faint transition-colors hover:text-fg">
              ← HOME
            </a>
          </div>
        </footer>
      )}
    </div>
  );
}
