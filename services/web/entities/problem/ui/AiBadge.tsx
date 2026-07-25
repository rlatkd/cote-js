// AI 생성 표식 — "Instrument" 컨셉. 캔디 알약·반짝이 대신
// 모노 대문자 라벨 + 앰버 헤어라인 테두리(계기 태그).

export default function AiBadge({
  size = "sm",
  label = "AI",
}: {
  size?: "xs" | "sm";
  label?: string;
}) {
  const pad =
    size === "xs" ? "px-1 py-[1px] text-[10px]" : "px-1.5 py-0.5 text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1 border border-brand/40 font-mono font-medium uppercase tracking-wider text-brand ${pad}`}
    >
      <span className="h-1 w-1 bg-brand" />
      {label}
    </span>
  );
}
