import type { Difficulty } from "../model";

// "Instrument" 컨셉 — 색 알약 대신 티어 도트 + 모노 라벨.
// 티어 색은 의미(백준식 계급)라 유지하되, 채도를 낮춰 계기판처럼 절제.
const dotColor: Record<Difficulty, string> = {
  Bronze: "bg-[#cd7f32]",
  Silver: "bg-[#9ca3af]",
  Gold: "bg-[#e8b923]",
  Platinum: "bg-[#3ec9c9]",
};

export default function DifficultyBadge({
  difficulty,
  tier,
}: {
  difficulty: Difficulty;
  tier?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-wide text-fg/80">
      <span className={`h-1.5 w-1.5 ${dotColor[difficulty]}`} />
      {tier ?? difficulty}
    </span>
  );
}
