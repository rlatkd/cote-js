"use client";

/**
 * 하단 패널 본문 — 실행 결과 / 테스트 케이스 / 제출 기록.
 *
 * **"터미널" 탭이 없다.** 1차 시안엔 있었는데, 우리는 터미널을 갖고 있지 않다.
 * 갖지 않은 것을 있는 척하는 요소는 걷어낸다(learning-notes '코스프레의 정체는
 * 장식의 양이 아니라 거짓말').
 */

import { Circle } from "lucide-react";
import { PASS, FAIL, WARN } from "./theme";
import { MY_SUBMISSIONS, statementOf } from "./data";
import { runVerdict, useWorkspace, type Doc } from "./workspace";

const VERDICT_COLOR: Record<string, string> = { AC: PASS, WA: FAIL, TLE: WARN };
const VERDICT_LABEL: Record<string, string> = {
  AC: "맞았습니다",
  WA: "틀렸습니다",
  TLE: "시간 초과",
};

export default function PanelContent({ doc }: { doc: Doc }) {
  const { panelTab, run } = useWorkspace();
  const problemId = "id" in doc ? doc.id : undefined;

  if (panelTab === 1) return <CaseListTab problemId={problemId} />;
  if (panelTab === 2) return <HistoryTab problemId={problemId} />;

  /* ── 실행 결과 ─────────────────────────────────────────── */
  if (!run) {
    return (
      <p className="pt-3 font-mono text-[12px] leading-relaxed text-faint">
        아직 실행한 결과가 없습니다.
        <br />
        에디터 위의 <span className="text-muted">예제 실행</span> 또는{" "}
        <span className="text-muted">제출</span>을 누르면 케이스가 하나씩 채워집니다.
      </p>
    );
  }

  const verdict = runVerdict(run);
  const worst = run.cases.reduce((a, c) => Math.max(a, c.ms), 0);
  const mem = run.cases.reduce((a, c) => Math.max(a, c.kb), 0);

  return (
    <div className="pt-1 font-mono text-[12px]">
      <div className="mb-2.5 flex flex-wrap items-center gap-3 text-[11px]">
        <span className="text-faint">
          {run.mode === "run" ? "예제 실행" : `제출 #${run.submissionId}`}
        </span>
        <span className="text-border-strong">|</span>
        {run.done ? (
          <span style={{ color: VERDICT_COLOR[verdict!] }}>{VERDICT_LABEL[verdict!]}</span>
        ) : (
          <span className="flex items-center gap-1.5" style={{ color: WARN }}>
            <Circle size={7} className="animate-pulse fill-current" />
            채점 중 {run.cases.length}/{run.total}
          </span>
        )}
        <span className="text-border-strong">|</span>
        <span className="text-faint">
          케이스 <span className="text-fg">{run.cases.filter((c) => c.verdict === "AC").length}</span> /{" "}
          {run.total} 통과
        </span>
        {run.done && (
          <>
            <span className="text-border-strong">|</span>
            <span className="text-faint">
              최대 {worst} ms · {(mem / 1024).toFixed(1)} MB
            </span>
          </>
        )}
      </div>

      {/* 아직 안 온 케이스도 자리를 잡아둔다 — 채워지는 게 보여야 실시간이 느껴진다 */}
      {Array.from({ length: run.total }, (_, i) => {
        const c = run.cases[i];
        return (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/60 py-[5px] last:border-0"
          >
            <span className="w-14 shrink-0 text-faint">케이스 {i + 1}</span>
            {c ? (
              <>
                <span className="w-8 shrink-0" style={{ color: VERDICT_COLOR[c.verdict] }}>
                  {c.verdict}
                </span>
                <span className="w-16 shrink-0 tabular-nums text-muted">{c.ms} ms</span>
                <span className="w-20 shrink-0 tabular-nums text-muted">
                  {(c.kb / 1024).toFixed(1)} MB
                </span>
                {c.verdict === "WA" && (
                  <span className="truncate text-faint">
                    기대 <span className="text-muted">5</span> · 실제{" "}
                    <span className="text-muted">4</span>
                  </span>
                )}
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-faint">
                <Circle size={6} className="animate-pulse fill-current" />
                대기
              </span>
            )}
          </div>
        );
      })}

      {run.mode === "run" && (
        <p className="mt-3 text-[11px] leading-relaxed text-faint">
          예제 실행은 <span className="text-muted">공개 예제</span>만 채점하고 기록에 남지 않습니다.
          히든 케이스는 제출에서만 돕니다.
        </p>
      )}
    </div>
  );
}

/* ── 테스트 케이스 탭 ──────────────────────────────────────── */

function CaseListTab({ problemId }: { problemId?: number }) {
  if (!problemId) {
    return <p className="pt-3 font-mono text-[12px] text-faint">문제를 열면 케이스가 보입니다.</p>;
  }
  const s = statementOf(problemId);
  return (
    <div className="pt-1 font-mono text-[12px]">
      <p className="mb-3 text-[11px] leading-relaxed text-faint">
        공개 예제 {s.examples.length}개 · 히든 {s.hiddenCount}개.{" "}
        <span className="text-muted">히든 케이스의 내용은 공개되지 않습니다</span> — 역추적으로
        정답을 맞히는 걸 막기 위해서입니다.
      </p>
      {s.examples.map((ex, i) => (
        <div key={i} className="mb-3 grid gap-3 sm:grid-cols-2">
          <Pre label={`예제 ${i + 1} 입력`}>{ex.in}</Pre>
          <Pre label={`예제 ${i + 1} 출력`}>{ex.out}</Pre>
        </div>
      ))}
      {Array.from({ length: s.hiddenCount }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-border/60 py-[5px] text-faint last:border-0"
        >
          <span className="w-20 shrink-0">히든 {i + 1}</span>
          <span>비공개</span>
        </div>
      ))}
    </div>
  );
}

function Pre({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-[0.1em] text-faint">{label}</div>
      <pre className="whitespace-pre-wrap border border-border bg-bg px-3 py-2 text-[12px] leading-relaxed text-fg">
        {children}
      </pre>
    </div>
  );
}

/* ── 제출 기록 탭 ──────────────────────────────────────────── */

function HistoryTab({ problemId }: { problemId?: number }) {
  const rows = problemId ? MY_SUBMISSIONS.filter((s) => s.problem === problemId) : MY_SUBMISSIONS;

  if (!rows.length) {
    return (
      <p className="pt-3 font-mono text-[12px] text-faint">이 문제에 제출한 기록이 없습니다.</p>
    );
  }

  return (
    <div className="pt-1 font-mono text-[12px]">
      {rows.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-4 border-b border-border/60 py-[5px] last:border-0"
        >
          <span className="w-14 shrink-0 text-faint">#{s.id}</span>
          <span className="w-20 shrink-0" style={{ color: VERDICT_COLOR[s.verdict!] }}>
            {VERDICT_LABEL[s.verdict!]}
          </span>
          <span className="w-20 shrink-0 text-muted">{s.lang}</span>
          <span className="w-16 shrink-0 tabular-nums text-muted">{s.ms} ms</span>
          <span className="w-20 shrink-0 tabular-nums text-muted">
            {(s.kb / 1024).toFixed(1)} MB
          </span>
          <span className="ml-auto shrink-0 tabular-nums text-faint">{s.at}</span>
        </div>
      ))}
    </div>
  );
}
