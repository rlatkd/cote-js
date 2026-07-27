"use client";

// problem-solving ViewModel — 에디터/채점 상태와 로직을 소유한다(MVVM).
// view(ProblemSolvingView)는 이 훅을 조합해 렌더링만 담당.

import { useEffect, useRef, useState } from "react";
import { type Language, type Problem } from "./model";
import { createSubmission } from "@/entities/submission/api";
import { isPending, type Submission } from "@/entities/submission/model";
import { BROWSER_API_URL } from "@/shared/api/client";

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
  // 실제 채점(제출) 결과 — judge가 Kafka로 돌려준 판정이 SSE로 도착한다.
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const streamRef = useRef<EventSource | null>(null);

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

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      streamRef.current?.close();
    },
    [],
  );

  function changeLanguage(lang: Language) {
    setLanguage(lang);
    setCode(problem.starterCode[lang]);
  }

  function resetCode() {
    setCode(problem.starterCode[language]);
    setResults([]);
    setSubmission(null);
    setError(null);
    setRunState("idle");
  }

  function judge(kind: RunMode) {
    if (kind === "submit") {
      void submitForJudging();
      return;
    }
    runExamples();
  }

  /**
   * 정식 제출 — api가 Kafka 제출 레인으로 보내고, judge의 판정이 결과 토픽을 거쳐
   * SSE로 돌아온다. 그래서 응답을 기다리지 않고 스트림에서 내 제출 id를 기다린다.
   */
  async function submitForJudging() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    streamRef.current?.close();

    setMode("submit");
    setRunState("running");
    setResults([]);
    setSubmission(null);
    setError(null);

    let accepted: Submission;
    try {
      accepted = await createSubmission({
        problemId: problem.id,
        language,
        code,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "제출에 실패했습니다");
      setRunState("idle");
      return;
    }

    setSubmission(accepted);
    if (!isPending(accepted)) {
      // 채점 자체가 불가한 경우(테스트케이스 미비 등)는 즉시 확정 결과가 온다.
      setRunState("done");
      return;
    }

    const source = new EventSource(`${BROWSER_API_URL}/submissions/stream`);
    streamRef.current = source;
    source.onmessage = (event) => {
      const incoming = JSON.parse(event.data) as Submission;
      if (incoming.id !== accepted.id) return;
      setSubmission(incoming);
      if (!isPending(incoming)) {
        setRunState("done");
        source.close();
        streamRef.current = null;
      }
    };
  }

  // 예제 실행은 아직 목업이다 — 공개 예제용 번들 발행 경로(run 레인)가 미구현(TODO).
  function runExamples() {
    const kind: RunMode = "run";
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMode(kind);
    setRunState("running");
    setResults([]);

    const total = problem.examples.length;
    const collected: TestResult[] = [];

    for (let i = 0; i < total; i++) {
      const t = setTimeout(() => {
        const passed = true;
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
    submission,
    error,
    changeLanguage,
    resetCode,
    judge,
  };
}
