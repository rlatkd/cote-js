"use client";

/**
 * 문제 풀이 — VS Code의 **분할 편집기** 골격. 좌: 지문 / 우: Monaco.
 * 셸(탭·사이드바·패널·상태바)은 `../../layout.tsx`가 들고 있으므로 여기는 본문만.
 *
 * 코드는 **문제별·언어별로 보존**된다(2026-08-08 확정). 탭을 닫고 나갔다 돌아와도,
 * 언어를 바꿨다 되돌려도 쓰던 코드가 그대로다 — 이게 "어제 풀다 만 문제로 복귀"의
 * 본체이고, 탭 목록은 그 대리 지표였을 뿐이다.
 */

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Play, Send, RotateCcw, ShieldCheck, ChevronDown } from "lucide-react";
import { LANGUAGES, MONACO_LANG, STARTER, problemById, statementOf } from "../../data";
import { useWorkspace } from "../../workspace";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-[13px] text-faint">
      에디터 불러오는 중…
    </div>
  ),
});

export default function SolveView({ id }: { id: number }) {
  const problem = problemById(id);
  const statement = statementOf(id);
  const { prefs, setPrefs, draft, setDraft, startRun, setAuthNotice, hydrated } = useWorkspace();

  const lang = prefs.language;
  const [langOpen, setLangOpen] = useState(false);
  const [code, setCode] = useState("");

  const splitLeft = prefs.splitLeft;

  // 저장된 초안 → 없으면 스타터. hydrated 전에 그리면 스타터가 잠깐 보였다 바뀐다.
  useEffect(() => {
    if (!hydrated) return;
    setCode(draft(id, lang) ?? STARTER[lang] ?? "");
  }, [id, lang, hydrated, draft]);

  const edit = (v: string) => {
    setCode(v);
    setDraft(id, lang, v);
  };

  const submit = () => {
    if (!prefs.signedIn) return setAuthNotice(true);
    setPrefs({ panelOpen: true });
    startRun(id, "submit", lang);
  };

  const runExamples = () => {
    setPrefs({ panelOpen: true });
    startRun(id, "run", lang);
  };

  if (!problem) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-faint">
        {id}번 문제를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <PanelGroup
      /* 저장된 비율은 hydration 이후에야 안다(SSR에는 localStorage가 없다).
         key를 한 번 바꿔 그 시점에 딱 한 번 다시 마운트시킨다 — 이후로는 안정적이다. */
      key={hydrated ? "hydrated" : "initial"}
      direction="horizontal"
      className="h-full"
      /* setPrefs가 같은 값이면 no-op이라(workspace.tsx) onLayout이 매 프레임
         불려도 상태가 흔들리지 않는다. 이 가드가 없으면 무한 루프였다. */
      onLayout={([left]) => setPrefs({ splitLeft: Math.round(left) })}
    >
      {/* ── 좌: 지문 ───────────────────────────────────────── */}
      <Panel
        defaultSize={splitLeft}
        minSize={26}
        className="flex flex-col bg-bg"
      >
        <PaneHeader>
          <span>문제.md — 미리보기</span>
          <Link
            href={`/lab2/p/${id}/verification`}
            className="ml-auto flex items-center gap-1.5 px-2 py-[3px] text-muted transition-colors hover:bg-elevated hover:text-fg"
            title="이 문제가 통과한 검증"
          >
            <ShieldCheck size={12} />
            검증 리포트
          </Link>
        </PaneHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          <div className="mb-4 flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className="border border-border-strong px-1.5 py-0.5 text-muted">
              {problem.tier}
            </span>
            {problem.ai && (
              <span className="border border-brand/50 px-1.5 py-0.5 text-brand">AI 생성</span>
            )}
            {problem.tags.map((t) => (
              <span key={t} className="border border-border px-1.5 py-0.5 text-faint">
                {t}
              </span>
            ))}
            <span className="ml-auto text-faint">정답률 {problem.rate}%</span>
          </div>

          <h1 className="text-[22px] font-semibold leading-snug tracking-tight">
            {problem.title}
          </h1>

          <div className="mt-3 flex gap-5 font-mono text-[11px] text-faint">
            <span>시간 제한 1초</span>
            <span>메모리 제한 256 MB</span>
          </div>

          <Section title="문제">
            <p>{statement.intro}</p>
            <p className="mt-3">{statement.detail}</p>
          </Section>
          <Section title="입력">
            <p className="whitespace-pre-line">{statement.input}</p>
          </Section>
          <Section title="출력">
            <p>{statement.output}</p>
          </Section>

          {statement.examples.map((ex, i) => (
            <Section key={i} title={`예제 ${i + 1}`}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Pre label="입력">{ex.in}</Pre>
                <Pre label="출력">{ex.out}</Pre>
              </div>
            </Section>
          ))}
        </div>
      </Panel>

      <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-brand" />

      {/* ── 우: 에디터 ─────────────────────────────────────── */}
      {/* defaultSize를 주지 않으면 서버 렌더 후 배치가 튄다(라이브러리 경고) */}
      <Panel defaultSize={100 - splitLeft} minSize={30} className="flex flex-col bg-bg">
        <PaneHeader>
          <div className="relative">
            <button
              onClick={() => setLangOpen((v) => !v)}
              onBlur={() => setTimeout(() => setLangOpen(false), 120)}
              className="flex items-center gap-1 text-muted transition-colors hover:text-fg"
            >
              {lang}
              <ChevronDown size={12} />
            </button>
            {langOpen && (
              <div className="absolute left-0 top-6 z-10 w-32 border border-border-strong bg-surface py-1">
                {LANGUAGES.map((l) => (
                  <button
                    key={l}
                    onClick={() => {
                      setPrefs({ language: l });
                      setLangOpen(false);
                    }}
                    className={`block w-full px-3 py-1 text-left text-[12px] transition-colors hover:bg-elevated ${
                      l === lang ? "text-brand" : "text-muted"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <ToolButton
              icon={RotateCcw}
              label="초기화"
              onClick={() => edit(STARTER[lang] ?? "")}
            />
            <ToolButton icon={Play} label="예제 실행" onClick={runExamples} />
            {/* 앰버가 채워진 버튼은 화면에 **하나뿐**이다 — 가장 중요한 행동에만 */}
            <button
              onClick={submit}
              className="ml-1 flex items-center gap-1.5 bg-brand px-3 py-[3px] text-[12px] text-brand-ink transition-colors hover:bg-brand-hover"
            >
              <Send size={12} />
              제출
            </button>
          </div>
        </PaneHeader>

        <div className="min-h-0 flex-1">
          <MonacoEditor
            height="100%"
            language={MONACO_LANG[lang] ?? "plaintext"}
            theme="vs-dark"
            path={`${id}.${lang}`}
            value={code}
            onChange={(v) => edit(v ?? "")}
            options={{
              fontSize: 13,
              fontFamily: "var(--font-mono), monospace",
              fontLigatures: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 12 },
              renderLineHighlight: "line",
              smoothScrolling: true,
              cursorBlinking: "smooth",
              scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
            }}
          />
        </div>
      </Panel>
    </PanelGroup>
  );
}

function PaneHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[30px] shrink-0 items-center gap-2 border-b border-border bg-bg px-3 font-mono text-[11px] text-faint">
      {children}
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Play;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-[3px] text-[12px] text-muted transition-colors hover:bg-elevated hover:text-fg"
    >
      <Icon size={12} />
      {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 text-[11px] uppercase tracking-[0.12em] text-faint">{title}</h2>
      <div className="text-[14px] leading-[1.85] text-muted">{children}</div>
    </section>
  );
}

function Pre({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
        {label}
      </div>
      <pre className="whitespace-pre-wrap border border-border bg-surface px-3 py-2 font-mono text-[12px] leading-relaxed text-fg">
        {children}
      </pre>
    </div>
  );
}
