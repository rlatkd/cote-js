// problem 도메인 모델 — arena 로컬 정의 (타입 + 순수 도메인 로직).
// hub(Kotlin)와의 API 계약 정합은 shared/api/contract-check.ts가 컴파일 타임에 검사한다(ADR-0007).

export const DIFFICULTIES = ["Bronze", "Silver", "Gold", "Platinum"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const LANGUAGES = ["Python", "C++", "Java", "JavaScript"] as const;
export type Language = (typeof LANGUAGES)[number];

/** UI 언어명 → Monaco 언어 id */
export const monacoLangMap: Record<Language, string> = {
  Python: "python",
  "C++": "cpp",
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
  timeLimit: string; // 예: "1초"
  memoryLimit: string; // 예: "256 MB"
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

/** 정답률(%) — 소수 첫째 자리까지. */
export function acceptanceRate(
  p: Pick<Problem, "submissionCount" | "acceptedCount">,
): number {
  if (p.submissionCount === 0) return 0;
  return Math.round((p.acceptedCount / p.submissionCount) * 1000) / 10;
}
