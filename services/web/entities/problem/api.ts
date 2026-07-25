// problem Repository — api(백엔드)에서 조회한다.
// 데이터 소스가 mock → api로 바뀌었지만 views/viewmodel은 무변경(Repository 경계).

import type { Problem } from "./model";
import { apiGet, apiGetOptional } from "@/shared/api/client";

export async function getProblems(): Promise<Problem[]> {
  return apiGet<Problem[]>("/problems");
}

export async function getProblem(id: number): Promise<Problem | undefined> {
  return apiGetOptional<Problem>(`/problems/${id}`);
}
