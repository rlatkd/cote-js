"use client";

// problem-solving ViewModel — 에디터/채점 상태와 로직을 소유한다(MVVM).
// view(ProblemSolvingView)는 이 훅을 조합해 렌더링만 담당.

import { useEffect, useRef, useState } from "react";
import { type Language, type Problem } from "./model";

export type TestResult = {
  no: number;
  passed: boolean;
  time: string;
  memory: string;
};

export type RunState = "idle" | "running" | "done";
export type RunMode = "run" | "submit";

export function useProblemSolving(problem: Problem) {
  const [language, setLanguage] = useState<Language>("Python");
  const [code, setCode] = useState<string>(problem.starterCode["Python"]);
  const [editorTheme, setEditorTheme] = useState<"vs-dark" | "light">("vs-dark");
  const [runState, setRunState] = useState<RunState>("idle");
  const [results, setResults] = useState<TestResult[]>([]);
  const [mode, setMode] = useState<RunMode>("run");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 사이트 테마와 에디터 테마 동기화
  useEffect(() => {
    const sync = () =>
      setEditorTheme(
        document.documentElement.classList.contains("dark") ? "vs-dark" : "light"
      );
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function changeLanguage(lang: Language) {
    setLanguage(lang);
    setCode(problem.starterCode[lang]);
  }

  function resetCode() {
    setCode(problem.starterCode[language]);
    setResults([]);
    setRunState("idle");
  }

  // POC: 실제 채점 대신 목업 결과를 지연 노출.
  function judge(kind: RunMode) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMode(kind);
    setRunState("running");
    setResults([]);

    const total = kind === "run" ? problem.examples.length : 4;
    const collected: TestResult[] = [];

    for (let i = 0; i < total; i++) {
      const t = setTimeout(() => {
        // 데모용: 제출 시 AI 생성 문제의 마지막 케이스만 가끔 실패시켜 결과 패널을 보여줌
        const passed = !(kind === "submit" && i === total - 1 && problem.aiGenerated);
        collected.push({
          no: i + 1,
          passed,
          time: `${40 + i * 18} ms`,
          memory: `${20 + i} MB`,
        });
        setResults([...collected]);
        if (collected.length === total) setRunState("done");
      }, 450 * (i + 1));
      timers.current.push(t);
    }
  }

  const allPassed =
    runState === "done" && results.length > 0 && results.every((r) => r.passed);

  return {
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
  };
}
