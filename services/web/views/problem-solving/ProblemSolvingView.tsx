"use client";

import dynamic from "next/dynamic";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Play, Send, RotateCcw, Clock, MemoryStick } from "lucide-react";
import {
  LANGUAGES,
  monacoLangMap,
  type Language,
  type Problem,
} from "@/entities/problem/model";
import { useProblemSolving } from "@/entities/problem/use-problem-solving";
import DifficultyBadge from "@/entities/problem/ui/DifficultyBadge";
import AiBadge from "@/entities/problem/ui/AiBadge";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted">
      에디터 불러오는 중…
    </div>
  ),
});

export default function ProblemSolvingView({ problem }: { problem: Problem }) {
  const {
    language,
    code,
    setCode,
    editorTheme,
    runState,
    results,
    mode,
    allPassed,
    changeLanguage,
    resetCode,
    judge,
  } = useProblemSolving(problem);

  return (
    <PanelGroup direction="horizontal" className="h-full">
      {/* 좌측: 문제 지문 */}
      <Panel defaultSize={45} minSize={25} className="flex flex-col">
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={problem.difficulty} tier={problem.tier} />
            {problem.aiGenerated && <AiBadge label="AI 생성" />}
            {problem.tags.map((tag) => (
              <span
                key={tag}
                className="border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted"
              >
                {tag}
              </span>
            ))}
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            <span className="font-mono text-brand">{problem.id}</span>{" "}
            {problem.title}
          </h1>

          <div className="mt-3 flex gap-4 border-b border-border pb-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Clock size={13} /> 시간 제한{" "}
              <span className="font-mono tabular-nums">{problem.timeLimit}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <MemoryStick size={13} /> 메모리 제한{" "}
              <span className="font-mono tabular-nums">{problem.memoryLimit}</span>
            </span>
          </div>

          <Section title="문제">
            <p className="whitespace-pre-line leading-relaxed">{problem.description}</p>
          </Section>
          <Section title="입력">
            <p className="whitespace-pre-line leading-relaxed">{problem.inputDesc}</p>
          </Section>
          <Section title="출력">
            <p className="whitespace-pre-line leading-relaxed">{problem.outputDesc}</p>
          </Section>

          {problem.examples.map((ex, i) => (
            <div key={i} className="mt-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mono-label mb-1.5">INPUT {i + 1}</div>
                  <pre className="overflow-x-auto border border-border bg-elevated p-3 font-mono text-xs">
                    {ex.input}
                  </pre>
                </div>
                <div>
                  <div className="mono-label mb-1.5">OUTPUT {i + 1}</div>
                  <pre className="overflow-x-auto border border-border bg-elevated p-3 font-mono text-xs">
                    {ex.output}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <PanelResizeHandle className="w-1.5 bg-border transition hover:bg-brand" />

      {/* 우측: 에디터 + 결과 (세로 분할) */}
      <Panel defaultSize={55} minSize={30}>
        <PanelGroup direction="vertical">
          <Panel defaultSize={65} minSize={25} className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
              <select
                value={language}
                onChange={(e) => changeLanguage(e.target.value as Language)}
                className="border border-border bg-surface px-2 py-1 font-mono text-[13px]"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <button
                onClick={resetCode}
                className="inline-flex items-center gap-1 px-2 py-1 font-mono text-xs text-muted transition hover:bg-elevated hover:text-fg"
              >
                <RotateCcw size={13} /> reset
              </button>
            </div>
            <div className="flex-1">
              <MonacoEditor
                language={monacoLangMap[language]}
                theme={editorTheme}
                value={code}
                onChange={(v) => setCode(v ?? "")}
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                  padding: { top: 12 },
                  tabSize: 4,
                }}
              />
            </div>
          </Panel>

          <PanelResizeHandle className="h-1.5 bg-border transition hover:bg-brand" />

          <Panel defaultSize={35} minSize={15} className="flex flex-col">
            <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2">
              <span className="mono-label !text-fg">OUTPUT</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => judge("run")}
                  disabled={runState === "running"}
                  className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 font-mono text-[13px] font-medium transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
                >
                  <Play size={14} /> 예제 실행
                </button>
                <button
                  onClick={() => judge("submit")}
                  disabled={runState === "running"}
                  className="inline-flex items-center gap-1.5 bg-brand px-3.5 py-1.5 font-mono text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-hover disabled:opacity-50"
                >
                  <Send size={14} /> 제출
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
              {runState === "idle" && (
                <p className="text-muted">
                  코드를 작성하고 <b>예제 실행</b> 또는 <b>제출</b>을 눌러보세요.
                  <span className="mt-1 block text-xs text-faint">
                    ※ POC 단계라 실제 채점 대신 목업 결과가 표시됩니다.
                  </span>
                </p>
              )}

              {runState !== "idle" && (
                <div className="space-y-2">
                  {runState === "done" && (
                    <div
                      className={`mb-3 border-l-2 py-2 pl-3 font-mono text-sm font-semibold ${
                        allPassed
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {allPassed
                        ? mode === "submit"
                          ? "맞았습니다!!"
                          : "예제를 모두 통과했습니다"
                        : "일부 테스트 케이스에서 실패했습니다"}
                    </div>
                  )}
                  {results.map((r) => (
                    <div
                      key={r.no}
                      className="flex items-center justify-between border border-border bg-surface px-3 py-2"
                    >
                      <span className="font-mono text-[13px]">
                        {mode === "run" ? "예제" : "case"} {r.no}
                      </span>
                      <div className="flex items-center gap-4 font-mono text-xs tabular-nums text-muted">
                        <span>{r.time}</span>
                        <span>{r.memory}</span>
                        <span
                          className={`font-semibold uppercase tracking-wide ${
                            r.passed
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {r.passed ? "pass" : "fail"}
                        </span>
                      </div>
                    </div>
                  ))}
                  {runState === "running" && (
                    <div className="flex items-center gap-2 py-1 font-mono text-[13px] text-muted">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                      채점 중…
                    </div>
                  )}
                </div>
              )}
            </div>
          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <h2 className="mono-label mb-2 flex items-center gap-1.5 !text-fg">
        <span className="text-brand">#</span>
        {title}
      </h2>
      <div className="text-sm leading-relaxed text-fg/80">{children}</div>
    </div>
  );
}
