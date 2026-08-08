"use client";

/**
 * 문제 목록 — 세 가지 검색 중 **탐색**의 자리.
 *
 * "골드 DP 중 정답률 40% 이상, 아직 안 푼 것" 같은 조건은 240px 사이드바에서 못 한다
 * (정렬 헤더도 다중 필터도 자리가 없다). 그래서 **에디터 영역 전체를 쓰는 표**로 둔다.
 * VS Code가 검색 결과를 사이드바에서 보다가 "편집기에서 열기"로 펼치는 것과 같은 구조다.
 *
 * → 내가 앞서 "VS Code 레이아웃이면 문제 목록 페이지가 사라진다"고 한 건 틀렸다.
 *   사이드바가 대체하는 건 *빠른 접근*까지고 *탐색*은 대체하지 못한다.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search, X } from "lucide-react";
import { GROUPS, PROBLEMS, type LabProblem } from "../data";
import { PASS, FAIL, WARN, TIER_COLOR } from "../theme";

const VERDICT_COLOR: Record<string, string> = { AC: PASS, WA: FAIL, TLE: WARN };
const ALL_TAGS = Array.from(new Set(PROBLEMS.flatMap((p) => p.tags))).sort();

type SortKey = "id" | "title" | "rate";

export default function ProblemsView() {
  const [q, setQ] = useState("");
  const [tiers, setTiers] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [aiOnly, setAiOnly] = useState(false);
  const [unsolvedOnly, setUnsolvedOnly] = useState(false);
  const [minRate, setMinRate] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "id", desc: true });

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = PROBLEMS.filter((p) => {
      if (aiOnly && !p.ai) return false;
      if (unsolvedOnly && p.verdict === "AC") return false;
      if (tiers.length && !tiers.includes(p.group)) return false;
      if (tags.length && !tags.some((t) => p.tags.includes(t))) return false;
      if (p.rate < minRate) return false;
      if (!needle) return true;
      return p.title.toLowerCase().includes(needle) || String(p.id).includes(needle);
    });
    const dir = sort.desc ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const av = sort.key === "title" ? a.title : (a[sort.key] as number);
      const bv = sort.key === "title" ? b.title : (b[sort.key] as number);
      return av > bv ? dir : av < bv ? -dir : 0;
    });
  }, [q, tiers, tags, aiOnly, unsolvedOnly, minRate, sort]);

  const hasFilter = Boolean(
    q || tiers.length || tags.length || aiOnly || unsolvedOnly || minRate > 0,
  );

  return (
    <div className="flex h-full flex-col">
      {/* ── 필터 줄 ─────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-[26px] w-[240px] items-center gap-1.5 border border-border bg-surface px-2">
            <Search size={12} className="shrink-0 text-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="번호 또는 제목"
              className="w-full bg-transparent text-[12px] text-fg outline-none placeholder:text-faint"
            />
          </div>

          <Divider />
          {GROUPS.map((g) => (
            <Chip key={g} on={tiers.includes(g)} onClick={() => toggle(tiers, setTiers, g)}>
              {g}
            </Chip>
          ))}

          <Divider />
          {ALL_TAGS.map((t) => (
            <Chip key={t} on={tags.includes(t)} onClick={() => toggle(tags, setTags, t)}>
              {t}
            </Chip>
          ))}

          <Divider />
          <Chip on={aiOnly} onClick={() => setAiOnly((v) => !v)}>
            AI 생성
          </Chip>
          <Chip on={unsolvedOnly} onClick={() => setUnsolvedOnly((v) => !v)}>
            안 푼 것만
          </Chip>

          <Divider />
          <label className="flex items-center gap-2 font-mono text-[11px] text-faint">
            정답률 ≥
            <input
              type="range"
              min={0}
              max={90}
              step={10}
              value={minRate}
              onChange={(e) => setMinRate(Number(e.target.value))}
              className="h-1 w-24 accent-[rgb(var(--brand))]"
            />
            <span className="w-8 tabular-nums text-muted">{minRate}%</span>
          </label>

          {hasFilter && (
            <button
              onClick={() => {
                setQ("");
                setTiers([]);
                setTags([]);
                setAiOnly(false);
                setUnsolvedOnly(false);
                setMinRate(0);
              }}
              className="ml-auto flex items-center gap-1 text-[11px] text-faint transition-colors hover:text-fg"
            >
              <X size={11} />
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* ── 표 ──────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full font-mono text-[12px]">
          <thead className="sticky top-0 bg-bg">
            <tr className="border-b border-border text-[11px] uppercase tracking-[0.1em] text-faint">
              <Th className="w-20 pl-6" sortKey="id" sort={sort} setSort={setSort}>
                번호
              </Th>
              <Th sortKey="title" sort={sort} setSort={setSort}>
                제목
              </Th>
              <Th className="w-28">티어</Th>
              <Th className="w-40">태그</Th>
              <Th className="w-24 text-right" sortKey="rate" sort={sort} setSort={setSort} right>
                정답률
              </Th>
              <Th className="w-20 pr-6 text-right">내 상태</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <Row key={p.id} p={p} />
            ))}
          </tbody>
        </table>

        {!rows.length && (
          <p className="py-16 text-center text-[13px] text-faint">
            조건에 맞는 문제가 없습니다.
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-border px-6 py-1.5 font-mono text-[11px] text-faint">
        {rows.length} / {PROBLEMS.length} 문제
      </div>
    </div>
  );
}

function Row({ p }: { p: LabProblem }) {
  return (
    <tr className="border-b border-border/60 transition-colors hover:bg-elevated/40">
      <td className="py-[7px] pl-6 text-faint">
        <Link href={`/lab2/p/${p.id}`} className="hover:text-brand">
          {p.id}
        </Link>
      </td>
      <td className="py-[7px]">
        <Link href={`/lab2/p/${p.id}`} className="text-fg hover:text-brand">
          {p.title}
        </Link>
        {p.ai && <span className="ml-2 text-[10px] tracking-[0.1em] text-faint">AI</span>}
      </td>
      <td className="py-[7px]" style={{ color: TIER_COLOR[p.group] }}>
        {p.tier}
      </td>
      <td className="py-[7px] text-faint">{p.tags.join(" · ")}</td>
      <td className="py-[7px] text-right tabular-nums text-muted">{p.rate}%</td>
      <td className="py-[7px] pr-6 text-right">
        {p.verdict ? (
          <span style={{ color: VERDICT_COLOR[p.verdict] }}>{p.verdict}</span>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
    </tr>
  );
}

function Th({
  children,
  className = "",
  sortKey,
  sort,
  setSort,
  right,
}: {
  children: React.ReactNode;
  className?: string;
  sortKey?: SortKey;
  sort?: { key: SortKey; desc: boolean };
  setSort?: (s: { key: SortKey; desc: boolean }) => void;
  right?: boolean;
}) {
  const active = sortKey && sort?.key === sortKey;
  return (
    <th className={`py-2 text-left font-normal ${className}`}>
      {sortKey && setSort && sort ? (
        <button
          onClick={() => setSort({ key: sortKey, desc: active ? !sort.desc : true })}
          className={`inline-flex items-center gap-1 transition-colors hover:text-fg ${
            active ? "text-fg" : ""
          } ${right ? "flex-row-reverse" : ""}`}
        >
          {children}
          {active &&
            (sort.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`border px-2 py-[2px] font-mono text-[11px] tracking-[0.04em] transition-colors ${
        on
          ? "border-brand text-brand"
          : "border-border text-faint hover:border-border-strong hover:text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-3 w-px bg-border" />;
}
