// submission 도메인 모델 — web 로컬 정의.
// api(Kotlin)와의 API 계약 정합은 shared/api/contract-check.ts가 컴파일 타임에 검사한다(ADR-0007).

import type { Language } from "@/entities/problem/model";

export const JUDGE_RESULTS = [
  "맞았습니다",
  "틀렸습니다",
  "시간 초과",
  "메모리 초과",
  "런타임 에러",
  "컴파일 에러",
  "채점 중",
] as const;
export type JudgeResult = (typeof JUDGE_RESULTS)[number];

export interface Submission {
  id: number;
  user: string;
  problemId: number;
  problemTitle: string;
  result: JudgeResult;
  language: Language;
  time: string;
  memory: string;
  length: number;
  submittedAt: string; // "YYYY-MM-DD HH:mm:ss"
}
