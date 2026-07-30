// submission Repository — 조회는 서버 컴포넌트에서 호출한다.
// 제출은 Server Action(actions.ts) — Next 서버를 거쳐야 추적·인증 쿠키가 이어진다.

import type { Submission } from "./model";
import { apiGet } from "@/shared/api/client";

export async function getSubmissions(): Promise<Submission[]> {
  return apiGet<Submission[]>("/submissions");
}
