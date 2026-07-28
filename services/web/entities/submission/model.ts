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

/** 실행 모드 — 예제 실행(run)은 기록에 남지 않고, 정식 제출(submit)만 채점 현황에 오른다. */
export type ExecutionMode = "run" | "submit";

export interface CaseResult {
  no: number;
  result: JudgeResult;
  execTimeMs: number | null;
  memoryUsedKb: number | null;
}

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
  mode: ExecutionMode;
  // ISO-8601 절대시각("2026-07-28T12:23:45Z") — 지역 시간 변환은 여기(화면)에서 한다.
  submittedAt: string;
  judgedAt: string | null;
  cases: CaseResult[];
}

/** 실행 시간 표시 — 미채점은 "—" */
export function formatExecTime(ms: number | null): string {
  return ms == null ? "—" : `${ms} ms`;
}

/** 사용 메모리 표시 — KB를 MB로(미채점은 "—") */
export function formatMemory(kb: number | null): string {
  return kb == null ? "—" : `${Math.round(kb / 1024)} MB`;
}

/**
 * 절대시각(ISO-8601) → 보는 사람의 지역 시간 표시.
 * 서버는 UTC만 다루고(ADR-0013) 지역 시간은 브라우저가 안다 — 그래서 변환이 여기 있다.
 */
export function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** 채점이 끝났는가 (SSE로 갱신될 대상인지 판별) */
export function isPending(s: Pick<Submission, "result">): boolean {
  return s.result === "채점 중";
}
