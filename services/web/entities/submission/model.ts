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
  "채점 오류", // 채점 시스템 장애 — 유저 코드 잘못이 아님
] as const;
export type JudgeResult = (typeof JUDGE_RESULTS)[number];

export interface Submission {
  id: number;
  user: string;
  problemId: number;
  problemTitle: string;
  result: JudgeResult;
  language: Language;
  // 채점 전에는 null — 표시("30 ms")는 화면에서 만든다.
  execTimeMs: number | null;
  memoryUsedKb: number | null;
  length: number;
  submittedAt: string; // "YYYY-MM-DD HH:mm:ss"
  judgedAt: string | null;
}

/** 실행 시간 표시 — 미채점은 "—" */
export function formatExecTime(ms: number | null): string {
  return ms == null ? "—" : `${ms} ms`;
}

/** 사용 메모리 표시 — KB를 MB로(미채점은 "—") */
export function formatMemory(kb: number | null): string {
  return kb == null ? "—" : `${Math.round(kb / 1024)} MB`;
}

/** 채점이 끝났는가 (SSE로 갱신될 대상인지 판별) */
export function isPending(s: Pick<Submission, "result">): boolean {
  return s.result === "채점 중";
}
