"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  acceptanceRate,
  type Difficulty,
  type Problem,
} from "@/entities/problem/model";
import DifficultyBadge from "@/entities/problem/ui/DifficultyBadge";
import AiBadge from "@/entities/problem/ui/AiBadge";

const DIFFICULTIES: (Difficulty | "전체")[] = [
  "전체",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
];

// 서버에서 페칭한 problems를 받아 클라이언트에서 필터링하는 client island.
export default function ProblemListView({ problems }: { problems: Problem[] }) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "전체">("전체");
  const [aiOnly, setAiOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return problems.filter((p) => {
      if (difficulty !== "전체" && p.difficulty !== difficulty) return false;
      if (aiOnly && !p.aiGenerated) return false;
      if (q) {
        const hay = `${p.id} ${p.title} ${p.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [problems, query, difficulty, aiOnly]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">문제</h1>
        <p className="mono-label mt-2">
          <span className="text-brand">{filtered.length}</span>
          {filtered.length !== problems.length && ` / ${problems.length}`} INDEXED
        </p>
      </header>

      {/* 필터 바 */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search"
            className="w-56 border border-border bg-surface py-1.5 pl-8 pr-3 font-mono text-[13px] outline-none transition placeholder:text-faint focus:border-brand"
          />
        </div>

        <div className="flex items-center gap-px bg-border">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`px-3 py-1.5 font-mono text-[13px] transition-colors ${
                difficulty === d
                  ? "bg-brand text-brand-ink"
                  : "bg-surface text-muted hover:text-fg"
              }`}
            >
              {d === "전체" ? "all" : d}
            </button>
          ))}
        </div>

        <button
          onClick={() => setAiOnly((v) => !v)}
          aria-pressed={aiOnly}
          className={`border px-3 py-1.5 font-mono text-[13px] uppercase tracking-wide transition-colors ${
            aiOnly
              ? "border-brand text-brand"
              : "border-border text-muted hover:text-fg"
          }`}
        >
          AI only
        </button>
      </div>

      {/* 계기 테이블 */}
      <div className="border-y border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border [&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left [&>th]:font-mono [&>th]:text-[11px] [&>th]:font-medium [&>th]:uppercase [&>th]:tracking-[0.14em] [&>th]:text-muted">
              <th className="!w-16">ID</th>
              <th>TITLE</th>
              <th className="hidden md:table-cell">TAGS</th>
              <th className="!w-36">TIER</th>
              <th className="hidden !text-right sm:table-cell">SUB</th>
              <th className="!w-20 !text-right">AC</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr
                key={p.id}
                className="group border-b border-border transition-colors hover:bg-elevated"
              >
                <td className="px-3 py-3 font-mono text-sm tabular-nums text-faint transition-colors group-hover:text-brand">
                  {p.id}
                </td>
                <td className="px-3 py-3">
                  <Link
                    href={`/problems/${p.id}`}
                    className="font-medium transition-colors hover:text-brand"
                  >
                    {p.title}
                  </Link>
                  {p.aiGenerated && (
                    <span className="ml-2 align-middle">
                      <AiBadge size="xs" />
                    </span>
                  )}
                </td>
                <td className="hidden px-3 py-3 md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {p.tags.map((tag) => (
                      <span
                        key={tag}
                        className="border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <DifficultyBadge difficulty={p.difficulty} tier={p.tier} />
                </td>
                <td className="hidden px-3 py-3 text-right font-mono text-sm tabular-nums text-muted sm:table-cell">
                  {p.submissionCount.toLocaleString()}
                </td>
                <td className="px-3 py-3 text-right font-mono text-sm font-medium tabular-nums">
                  {acceptanceRate(p)}%
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-14 text-center font-mono text-sm text-faint"
                >
                  조건에 맞는 문제가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
