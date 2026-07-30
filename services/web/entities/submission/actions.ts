"use server";

// 제출 Server Action — 브라우저 fetch 대신 Next 서버를 거친다.
// 브라우저 직접 호출이던 것을 옮긴 이유:
//   ① 추적 시작점 = Next 서버(traceparent 발급, 신뢰 경계 안) — 브라우저 발급 값은
//      api가 재검증해야 해 이점이 없다
//   ② 인증 쿠키(httpOnly)가 first-party로 유지된다 — 도입 예정인 인증의 선행 정지작업
// SSE(EventSource)는 여전히 브라우저가 api에 직접 붙는다(스트림은 프록시 실익 없음).

import { apiPost } from "@/shared/api/client";
import type { Language } from "@/entities/problem/model";
import type { ExecutionMode, Submission } from "./model";

/**
 * 코드 제출 — 응답은 "채점 중" 상태의 제출이다(채점은 비동기).
 * 최종 판정은 SSE로 도착한다(`/submissions/stream`).
 */
export async function submitCode(input: {
  problemId: number;
  language: Language;
  code: string;
  mode?: ExecutionMode;
}): Promise<Submission> {
  return apiPost<Submission>("/submissions", input);
}
