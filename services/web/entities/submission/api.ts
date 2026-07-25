// submission Repository — api(백엔드)에서 조회한다.

import type { Submission } from "./model";
import { apiGet } from "@/shared/api/client";

export async function getSubmissions(): Promise<Submission[]> {
  return apiGet<Submission[]>("/submissions");
}
