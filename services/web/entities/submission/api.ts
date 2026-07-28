// submission Repository — 조회는 서버 컴포넌트에서, 제출은 브라우저에서 호출한다.

import type { ExecutionMode, Submission } from "./model";
import { BROWSER_API_URL, apiGet } from "@/shared/api/client";
import type { Language } from "@/entities/problem/model";

export async function getSubmissions(): Promise<Submission[]> {
  return apiGet<Submission[]>("/submissions");
}

/**
 * 코드 제출 — 응답은 "채점 중" 상태의 제출이다(채점은 비동기).
 * 최종 판정은 SSE로 도착한다(`/submissions/stream`).
 */
export async function createSubmission(input: {
  problemId: number;
  language: Language;
  code: string;
  user?: string;
  mode?: ExecutionMode;
}): Promise<Submission> {
  const res = await fetch(`${BROWSER_API_URL}/submissions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`제출 실패: ${res.status}`);
  }
  return res.json() as Promise<Submission>;
}
