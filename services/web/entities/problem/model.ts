// problem 도메인 모델 — web 로컬 정의 (타입 + 순수 도메인 로직).
// api(Kotlin)와의 API 계약 정합은 shared/api/contract-check.ts가 컴파일 타임에 검사한다(ADR-0007).

export const DIFFICULTIES = ["Bronze", "Silver", "Gold", "Platinum"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

// judge가 실제로 채점할 수 있는 언어만 노출한다 — UI가 약속한 언어를 채점기가
// 지원하지 않으면 오판정(런타임 에러)으로 이어진다.
export const LANGUAGES = ["Python", "Java", "JavaScript"] as const;
export type Language = (typeof LANGUAGES)[number];

/** UI 언어명 → Monaco 언어 id */
export const monacoLangMap: Record<Language, string> = {
  Python: "python",
  Java: "java",
  JavaScript: "javascript",
};

export interface Example {
  input: string;
  output: string;
}

export interface Problem {
  id: number;
  title: string;
  difficulty: Difficulty;
  tier: string; // 예: "Silver III"
  // api는 수치를 준다 — 표시 형식("1초"·"256 MB")은 화면의 관심사이므로 여기서 만든다.
  timeLimitMs: number;
  memoryLimitMb: number;
  submissionCount: number;
  acceptedCount: number;
  tags: string[];
  aiGenerated: boolean;
  description: string;
  inputDesc: string;
  outputDesc: string;
  examples: Example[];
  starterCode: Record<string, string>;
}

/** 제한 표시 — "1초" / "1.5초" */
export function formatTimeLimit(ms: number): string {
  const seconds = ms / 1000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}초`;
}

/** 제한 표시 — "256 MB" */
export function formatMemoryLimit(mb: number): string {
  return `${mb} MB`;
}

/** 정답률(%) — 소수 첫째 자리까지. */
export function acceptanceRate(
  p: Pick<Problem, "submissionCount" | "acceptedCount">,
): number {
  if (p.submissionCount === 0) return 0;
  return Math.round((p.acceptedCount / p.submissionCount) * 1000) / 10;
}
