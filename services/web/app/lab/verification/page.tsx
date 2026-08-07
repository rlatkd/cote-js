/**
 * 디자인 랩 — 검증 리포트 페이지 (2026-08-06)
 *
 * 홈에 있던 VERIFICATION 섹션을 독립 페이지로 분리했다. 홈은 "무엇이 있나"를
 * 보여주는 자리고, 이 페이지는 **"이 문제를 왜 믿을 수 있나"**에 답하는 자리다.
 * 홈에 두면 스크롤만 늘고 정작 내용은 요약본이 된다.
 *
 * 실제 서비스에서는 문제별 상세(`/problems/[id]/verification`)로 붙을 성격이고,
 * 여기서는 랩 시안이므로 고정 데이터로 그린다.
 */

import LabNav from "../LabNav";
import { buildTheme, DEFAULTS, GREEN, RED } from "../theme";

const STEPS = [
  { n: "01", key: "DRAFT", desc: "LLM이 문제 초안을 생성", meta: "nemotron-3-super-120b", val: "2.4s" },
  { n: "02", key: "SOLVERS", desc: "독립 풀이 3개 생성 — 지문만 노출", meta: "의도 풀이 차단", val: "8.1s" },
  { n: "03", key: "EXECUTE", desc: "judge 샌드박스에서 실채점", meta: "batch 레인 · 5 cases × 3", val: "2.6s" },
  { n: "04", key: "CONSENSUS", desc: "출력 해시 전원 일치", meta: "3 / 3 합의", val: "PASS" },
  { n: "05", key: "REVIEW", desc: "사람 검수 승인", meta: "@rlatkd", val: "08-03" },
];

/** 독립 풀이별 케이스 출력 해시 — 같으면 같은 답에 도달한 것이다. */
const SOLUTIONS = [
  { name: "solver-1", approach: "BFS + 방문 배열", hashes: ["4e0740", "6b51d4", "d4735e", "4e0740", "ef2d12"], agree: true },
  { name: "solver-2", approach: "덱 기반 BFS", hashes: ["4e0740", "6b51d4", "d4735e", "4e0740", "ef2d12"], agree: true },
  { name: "solver-3", approach: "다익스트라 축약", hashes: ["4e0740", "6b51d4", "d4735e", "4e0740", "ef2d12"], agree: true },
];

const CASES = [
  { no: 1, ms: 24, kb: 9100 },
  { no: 2, ms: 31, kb: 9300 },
  { no: 3, ms: 28, kb: 9200 },
  { no: 4, ms: 22, kb: 9100 },
  { no: 5, ms: 19, kb: 9000 },
];

export default function VerificationPage() {
  const t = buildTheme(DEFAULTS);
  const { d, labelFont, showPaneBorder, showPaneTitle, showLeaders, showPrompts } = t;

  const paneCls = `relative ${showPaneBorder ? "border border-border" : ""}`;
  const panePad = { padding: showPaneBorder ? `${1.4 * d}rem` : 0 };

  return (
    <div
      style={t.tokens}
      className={`${t.fontVars} fixed inset-0 z-50 overflow-y-auto bg-bg text-fg`}
    >
      <LabNav current="verification" d={d} />

      <main className="mx-auto max-w-6xl px-5" style={{ paddingBottom: `${4 * d}rem` }}>
        {/* ── 표제 ─────────────────────────────────────── */}
        <section style={{ paddingTop: `${3 * d}rem`, paddingBottom: `${2.4 * d}rem` }}>
          <p
            className="mb-4 flex items-center gap-2 text-[11px] tracking-[0.18em] text-faint"
            style={labelFont}
          >
            {showPrompts && <span className="text-brand">//</span>}
            VERIFICATION REPORT
          </p>
          <h1 className="flex flex-wrap items-baseline gap-x-3 text-[24px] leading-snug tracking-tight sm:text-[30px]">
            <span className="tabular-nums text-faint" style={labelFont}>
              4821
            </span>
            <span>우주 정거장의 에코 드론 관리</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[13px] leading-[1.95] text-muted">
            {showPrompts && <span className="text-brand">&gt; </span>}
            문제와 정답을 같은 모델이 함께 만들면, 정답이 틀려도 테스트는 100% 통과합니다
            (자답자채점). 그래서 이 문제는{" "}
            <span className="text-fg">지문만 보고 푼 독립 풀이들이 같은 답에 도달할 때만</span>{" "}
            정답을 채택했습니다. 실행은 유저 제출과 똑같은 샌드박스에서 이뤄집니다.
          </p>
        </section>

        {/* ── 단계 ─────────────────────────────────────── */}
        <div className={paneCls} style={panePad}>
          {showPaneTitle ? (
            <span
              className="absolute -top-[7px] left-4 bg-bg px-2 text-[11px] tracking-[0.18em] text-brand"
              style={labelFont}
            >
              PIPELINE
            </span>
          ) : (
            <h2 className="mb-4 text-[12px] tracking-[0.18em]" style={labelFont}>
              PIPELINE
            </h2>
          )}
          <ol className="border-t border-border">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="flex items-baseline gap-3 border-b border-border"
                style={{ paddingTop: `${0.7 * d}rem`, paddingBottom: `${0.7 * d}rem` }}
              >
                <span
                  className="w-6 shrink-0 text-[11px] tabular-nums text-faint"
                  style={labelFont}
                >
                  {s.n}
                </span>
                <span
                  className="w-24 shrink-0 text-[11px] tracking-[0.14em] text-brand"
                  style={labelFont}
                >
                  {s.key}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{s.desc}</span>
                <span className="hidden shrink-0 text-[11px] text-faint sm:block">
                  {s.meta}
                </span>
                {showLeaders && (
                  <span className="hidden w-10 flex-none border-b border-dashed border-border sm:block" />
                )}
                <span
                  className="w-14 shrink-0 text-right text-[12px] tabular-nums"
                  style={{ ...labelFont, color: GREEN }}
                >
                  {s.val}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* ── 합의 표 ─────────────────────────────────────
            이 페이지의 핵심. 출력 원문이 아니라 해시를 비교하는데,
            judge가 결과에 실어 보내는 값이 해시이기 때문이다(계약: output_sha256). */}
        <div className={paneCls} style={{ ...panePad, marginTop: `${2.6 * d}rem` }}>
          {showPaneTitle ? (
            <span
              className="absolute -top-[7px] left-4 bg-bg px-2 text-[11px] tracking-[0.18em] text-brand"
              style={labelFont}
            >
              CONSENSUS
            </span>
          ) : (
            <h2 className="mb-4 text-[12px] tracking-[0.18em]" style={labelFont}>
              CONSENSUS
            </h2>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-border text-left text-[10px] tracking-[0.16em] text-faint">
                  <th className="py-2 pr-3 font-normal" style={labelFont}>
                    SOLVER
                  </th>
                  <th className="py-2 pr-3 font-normal" style={labelFont}>
                    APPROACH
                  </th>
                  {CASES.map((c) => (
                    <th key={c.no} className="py-2 pr-3 font-normal" style={labelFont}>
                      #{c.no}
                    </th>
                  ))}
                  <th className="py-2 text-right font-normal" style={labelFont}>
                    RESULT
                  </th>
                </tr>
              </thead>
              <tbody>
                {SOLUTIONS.map((s) => (
                  <tr key={s.name} className="border-b border-border">
                    <td
                      className="py-2.5 pr-3 text-muted"
                      style={labelFont}
                    >
                      {s.name}
                    </td>
                    <td className="py-2.5 pr-3 text-faint">{s.approach}</td>
                    {s.hashes.map((h, i) => (
                      <td
                        key={i}
                        className="py-2.5 pr-3 tabular-nums text-faint"
                        style={labelFont}
                      >
                        {h}
                      </td>
                    ))}
                    <td
                      className="py-2.5 text-right"
                      style={{ ...labelFont, color: s.agree ? GREEN : RED }}
                    >
                      {s.agree ? "AGREE" : "DIVERGE"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 max-w-2xl text-[12px] leading-[1.9] text-muted">
            비교하는 값은 출력 원문이 아니라 <span className="text-fg">정규화된 출력의
            해시</span>입니다. 채점기가 결과에 해시만 실어 보내기 때문이고(원문을 결과
            토픽에 싣는 건 과합니다), 동일성 판단에는 해시로 충분합니다. 세 풀이가 서로 다른
            접근으로 같은 해시에 도달했다는 것이 합의의 근거입니다.
          </p>
        </div>

        {/* ── 케이스별 실행 ────────────────────────────── */}
        <div className={paneCls} style={{ ...panePad, marginTop: `${2.6 * d}rem` }}>
          {showPaneTitle ? (
            <span
              className="absolute -top-[7px] left-4 bg-bg px-2 text-[11px] tracking-[0.18em] text-brand"
              style={labelFont}
            >
              SANDBOX
            </span>
          ) : (
            <h2 className="mb-4 text-[12px] tracking-[0.18em]" style={labelFont}>
              SANDBOX
            </h2>
          )}
          <ul className="grid grid-cols-2 gap-px bg-border sm:grid-cols-5">
            {CASES.map((c) => (
              <li key={c.no} className="bg-bg px-4 py-3.5">
                <div className="text-[10px] tracking-[0.16em] text-faint" style={labelFont}>
                  CASE {c.no}
                </div>
                <div className="mt-2 text-[15px] tabular-nums" style={labelFont}>
                  {c.ms}
                  <span className="ml-0.5 text-[11px] text-faint">ms</span>
                </div>
                <div className="mt-1 text-[11px] tabular-nums text-faint" style={labelFont}>
                  {(c.kb / 1024).toFixed(1)} MB
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] leading-[1.9] text-muted">
            네트워크 차단 · 읽기 전용 파일시스템 · 프로세스 수 제한이 걸린 컨테이너에서
            실행됩니다. 유저 제출과 같은 경계입니다.
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
              VERIFIED <span style={{ color: GREEN }}>●</span> 3 / 3 AGREE
            </span>
            <span className="text-faint">REVIEWED 2026-08-06</span>
            <a href="/lab" className="ml-auto text-faint transition-colors hover:text-fg">
              ← HOME
            </a>
          </div>
        </footer>
      )}
    </div>
  );
}
