// problem Repository — hub(백엔드 API)에서 조회한다.
// 데이터 소스가 mock → hub로 바뀌었지만 views/viewmodel은 무변경(Repository 경계).

import type { Problem } from "./model";
import { hubGet, hubGetOptional } from "@/shared/api/hub";

export async function getProblems(): Promise<Problem[]> {
  return hubGet<Problem[]>("/problems");
}

export async function getProblem(id: number): Promise<Problem | undefined> {
  return hubGetOptional<Problem>(`/problems/${id}`);
}
