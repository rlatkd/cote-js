import Link from "next/link";
import type { Submission } from "@/entities/submission/model";
import StatusBadge from "@/entities/submission/ui/StatusBadge";

export default function SubmissionStatusView({
  submissions,
}: {
  submissions: Submission[];
}) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">채점 현황</h1>
        <p className="mono-label mt-2">REALTIME JUDGE FEED</p>
      </header>

      <div className="overflow-x-auto border-y border-border">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-border [&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left [&>th]:font-mono [&>th]:text-[11px] [&>th]:font-medium [&>th]:uppercase [&>th]:tracking-[0.14em] [&>th]:text-muted">
              <th>ID</th>
              <th>USER</th>
              <th>PROBLEM</th>
              <th>RESULT</th>
              <th>LANG</th>
              <th className="!text-right">TIME</th>
              <th className="!text-right">MEM</th>
              <th className="!text-right">AT</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr
                key={s.id}
                className="group border-b border-border transition-colors hover:bg-elevated"
              >
                <td className="px-3 py-3 font-mono text-sm tabular-nums text-faint transition-colors group-hover:text-brand">
                  {s.id}
                </td>
                <td className="px-3 py-3 font-mono text-sm text-fg">{s.user}</td>
                <td className="px-3 py-3">
                  <Link
                    href={`/problems/${s.problemId}`}
                    className="transition-colors hover:text-brand"
                  >
                    {s.problemTitle}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <StatusBadge result={s.result} />
                </td>
                <td className="px-3 py-3 font-mono text-sm text-muted">
                  {s.language}
                </td>
                <td className="px-3 py-3 text-right font-mono text-sm tabular-nums text-muted">
                  {s.time}
                </td>
                <td className="px-3 py-3 text-right font-mono text-sm tabular-nums text-muted">
                  {s.memory}
                </td>
                <td className="px-3 py-3 text-right font-mono text-sm tabular-nums text-faint">
                  {s.submittedAt}
                </td>
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-14 text-center font-mono text-sm text-faint"
                >
                  아직 제출 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
