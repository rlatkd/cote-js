"use client";

// 제출 실시간 갱신 ViewModel — SSE 구독(MVVM: 뷰는 이 훅을 쓰기만 한다).
//
// 채점이 비동기라 목록을 열어둔 동안 상태가 바뀐다. 폴링 대신 서버 푸시를 받는다
// (단방향 알림이라 WebSocket이 아닌 SSE — ADR-0006).

import { useEffect, useState } from "react";
import { BROWSER_API_URL } from "@/shared/api/client";
import type { Submission } from "./model";

/** 서버가 보내주는 갱신을 초기 목록 위에 병합한다. */
export function useSubmissionStream(initial: Submission[]): Submission[] {
  const [submissions, setSubmissions] = useState(initial);

  // 서버 렌더로 받은 초기 목록이 바뀌면(라우팅·새로고침) 그것을 기준으로 되돌린다.
  useEffect(() => setSubmissions(initial), [initial]);

  useEffect(() => {
    // EventSource는 끊기면 브라우저가 알아서 재연결한다(SSE 채택 이유 중 하나).
    const source = new EventSource(`${BROWSER_API_URL}/submissions/stream`);

    source.onmessage = (event) => {
      const incoming = JSON.parse(event.data) as Submission;
      setSubmissions((prev) => {
        const index = prev.findIndex((s) => s.id === incoming.id);
        // 새 제출은 목록 맨 앞(최신순), 기존 제출은 제자리에서 갱신.
        if (index === -1) return [incoming, ...prev];
        const next = [...prev];
        next[index] = incoming;
        return next;
      });
    };

    return () => source.close();
  }, []);

  return submissions;
}
