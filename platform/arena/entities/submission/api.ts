// submission Repository — hub(백엔드 API)에서 조회한다.

import type { Submission } from "./model";
import { hubGet } from "@/shared/api/hub";

export async function getSubmissions(): Promise<Submission[]> {
  return hubGet<Submission[]>("/submissions");
}
