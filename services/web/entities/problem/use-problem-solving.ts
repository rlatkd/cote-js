"use client";

// problem-solving ViewModel — 에디터/채점 상태와 로직을 소유한다(MVVM).
// view(ProblemSolvingView)는 이 훅을 조합해 렌더링만 담당.
//
// 예제 실행(run)과 정식 제출(submit)은 **같은 채점 경로**를 탄다 — 무엇으로 채점하느냐
// (공개 예제 vs 히든 케이스)와 어느 QoS 레인으로 가느냐만 다르다(api가 결정).

import { useEffect, useRef, useState } from "react";
import { type Language, type Problem } from "./model";
import { submitCode } from "@/entities/submission/actions";
import {
  isPending,
  type ExecutionMode,
  type Submission,
} from "@/entities/submission/model";
import { BROWSER_API_URL } from "@/shared/api/client";

export type RunState = "idle" | "running" | "done";
export type RunMode = ExecutionMode;

export function useProblemSolving(problem: Problem) {
  const [language, setLanguage] = useState<Language>("Python");
  const [code, setCode] = useState<string>(problem.starterCode["Python"]);
  const [editorTheme, setEditorTheme] = useState<"vs-dark" | "light">("vs-dark");
  const [runState, setRunState] = useState<RunState>("idle");
  const [mode, setMode] = useState<RunMode>("submit");
  // judge가 Kafka로 돌려준 판정이 SSE로 도착한다.
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => () => streamRef.current?.close(), []);

  function changeLanguage(lang: Language) {
    setLanguage(lang);
    setCode(problem.starterCode[lang]);
  }

  function resetCode() {
    setCode(problem.starterCode[language]);
    setSubmission(null);
    setError(null);
    setRunState("idle");
  }

  /**
   * 채점 요청 — api가 접수만 응답하고(비동기), 최종 판정은 SSE로 돌아온다.
   * 그래서 응답을 기다리는 대신 스트림에서 **내 제출 id**를 기다린다.
   */
  async function judge(kind: RunMode) {
    streamRef.current?.close();
    setMode(kind);
    setRunState("running");
    setSubmission(null);
    setError(null);

    let accepted: Submission;
    try {
      // Server Action — Next 서버가 traceparent를 발급해 api로 전달한다.
      accepted = await submitCode({
        problemId: problem.id,
        language,
        code,
        mode: kind,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청에 실패했습니다");
      setRunState("idle");
      return;
    }

    setSubmission(accepted);
    if (!isPending(accepted)) {
      // 채점 자체가 불가한 경우(데이터 미비 등)는 즉시 확정 결과가 온다.
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

  const accepted = submission?.result === "맞았습니다";

  return {
    language,
    code,
    setCode,
    editorTheme,
    runState,
    mode,
    submission,
    accepted,
    error,
    changeLanguage,
    resetCode,
    judge,
  };
}
