import type { JudgeResult } from "../model";

// "Instrument" 컨셉 — 색 알약 대신 상태 도트 + 모노 라벨.
// 색(결과 의미)은 유지하되 브랜드 앰버와 겹치지 않는 계열로.
const dotColor: Record<JudgeResult, string> = {
  맞았습니다: "bg-emerald-500",
  틀렸습니다: "bg-rose-500",
  "시간 초과": "bg-amber-400",
  "메모리 초과": "bg-amber-400",
  "런타임 에러": "bg-violet-400",
  "컴파일 에러": "bg-zinc-500",
  "채점 중": "bg-sky-400",
};

export default function StatusBadge({ result }: { result: JudgeResult }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-fg/85">
      <span
        className={`h-1.5 w-1.5 ${dotColor[result]} ${
          result === "채점 중" ? "animate-pulse" : ""
        }`}
      />
      {result}
    </span>
  );
}
