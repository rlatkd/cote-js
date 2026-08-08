"use client";

/**
 * lab2 사이드바 — 액티비티 바가 고른 **목록**을 띄운다.
 *
 * 규칙(2026-08-08 확정): **사이드바는 목록, 에디터는 상세.** 사이드바에서 무언가를
 * 클릭하면 에디터에 문서가 열린다(= URL이 바뀐다). 액티비티 전환 자체는 URL을
 * 건드리지 않으므로 **열어둔 문서는 그대로 남는다** — 이게 VS Code 골격의 핵심이고,
 * lab2 1차에서 빠뜨렸던 부분이다.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search, Table2, X } from "lucide-react";
import { PASS, FAIL, WARN, TIER_COLOR, MUTED_ICON } from "./theme";
import {
  FEED,
  GROUPS,
  PROBLEMS,
  RANKING,
  VERIFIED_RECENT,
  type Verdict,
} from "./data";
import type { Activity } from "./workspace";

const VERDICT_COLOR: Record<string, string> = { AC: PASS, WA: FAIL, TLE: WARN };

export default function Sidebar({
  activity,
  activeId,
}: {
  activity: Activity;
  activeId?: number;
}) {
  return (
    <div className="flex h-full flex-col">
      {activity === "explorer" && <ExplorerView activeId={activeId} />}
      {activity === "status" && <StatusView />}
      {activity === "ranking" && <RankingView />}
      {activity === "verification" && <VerificationView activeId={activeId} />}
    </div>
  );
}

/* ── 헤더 ──────────────────────────────────────────────────── */

function Header({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex h-[35px] shrink-0 items-center gap-2 pl-4 pr-2">
      <span className="text-[11px] uppercase tracking-[0.12em] text-faint">{title}</span>
      <span className="ml-auto">{action}</span>
    </div>
  );
}

/** "편집기에서 열기" — 좁은 사이드바가 못 담는 전체 표를 문서 탭으로 펼친다. */
function OpenFullTable({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      title={label}
      className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-faint transition-colors hover:bg-elevated hover:text-fg"
    >
      <Table2 size={13} />
    </Link>
  );
}

/* ── 문제 탐색기 ───────────────────────────────────────────── */

function ExplorerView({ activeId }: { activeId?: number }) {
  const [open, setOpen] = useState<string[]>([...GROUPS]);
  const [q, setQ] = useState("");
  const [tiers, setTiers] = useState<string[]>([]);
  const [aiOnly, setAiOnly] = useState(false);

  const toggleGroup = (g: string) =>
    setOpen((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));
  const toggleTier = (t: string) =>
    setTiers((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return PROBLEMS.filter((p) => {
      if (aiOnly && !p.ai) return false;
      if (tiers.length && !tiers.includes(p.group)) return false;
      if (!needle) return true;
      return p.title.toLowerCase().includes(needle) || String(p.id).includes(needle);
    });
  }, [q, tiers, aiOnly]);

  return (
    <>
      <Header title="문제" action={<OpenFullTable href="/lab2/problems" label="전체 목록" />} />

      {/* 좁히기 — 세 가지 검색 중 첫째(engineering-notes 'lab2'). 목록 바로 위에 둔다. */}
      <div className="shrink-0 px-2 pb-2">
        <div className="flex h-[24px] items-center gap-1.5 border border-border bg-elevated px-2">
          <Search size={11} className="shrink-0 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="목록에서 찾기"
            className="w-full bg-transparent text-[12px] text-fg outline-none placeholder:text-faint"
          />
          {q && (
            <X
              size={11}
              className="shrink-0 cursor-pointer text-faint hover:text-fg"
              onClick={() => setQ("")}
            />
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {GROUPS.map((g) => (
            <Chip key={g} on={tiers.includes(g)} onClick={() => toggleTier(g)}>
              {g}
            </Chip>
          ))}
          <Chip on={aiOnly} onClick={() => setAiOnly((v) => !v)}>
            AI
          </Chip>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {GROUPS.map((g) => {
          const items = filtered.filter((p) => p.group === g);
          if (!items.length) return null;
          const isOpen = open.includes(g);
          return (
            <div key={g}>
              <button
                onClick={() => toggleGroup(g)}
                className="flex w-full items-center gap-1 py-[3px] pl-2 pr-3 text-left transition-colors hover:bg-elevated"
              >
                {isOpen ? (
                  <ChevronDown size={14} className={MUTED_ICON} />
                ) : (
                  <ChevronRight size={14} className={MUTED_ICON} />
                )}
                <span
                  className="font-mono text-[11px] tracking-[0.08em]"
                  style={{ color: TIER_COLOR[g] }}
                >
                  {g}
                </span>
                <span className="ml-auto font-mono text-[11px] text-faint">{items.length}</span>
              </button>

              {isOpen &&
                items.map((p) => (
                  <Row
                    key={p.id}
                    href={`/lab2/p/${p.id}`}
                    active={p.id === activeId}
                    left={p.id}
                    label={p.title}
                    right={
                      p.verdict ? (
                        <span style={{ color: VERDICT_COLOR[p.verdict] }}>{p.verdict}</span>
                      ) : null
                    }
                  />
                ))}
            </div>
          );
        })}
        {!filtered.length && (
          <p className="px-4 py-6 text-center text-[12px] text-faint">일치하는 문제가 없습니다.</p>
        )}
      </div>
    </>
  );
}

/* ── 채점 현황 (전체 공개 피드) ─────────────────────────────── */

function StatusView() {
  return (
    <>
      <Header title="채점 현황" />
      {/* 내 제출은 여기 없다 — 마이페이지 전용(2026-08-08 확정). 역할을 겹치지 않게. */}
      <p className="shrink-0 px-4 pb-2 text-[11px] leading-relaxed text-faint">
        모두의 제출이 실시간으로 흐릅니다
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {FEED.map((s) => (
          <Link
            key={s.id}
            href="/lab2"
            className="group flex items-center gap-2 py-[4px] pl-3 pr-2 transition-colors hover:bg-elevated"
          >
            <VerdictDot verdict={s.verdict} />
            <span className="w-9 shrink-0 font-mono text-[11px] tabular-nums text-faint">
              {s.problem}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-muted group-hover:text-fg">
              {s.user}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-faint">
              {s.verdict ?? s.progress}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

/* ── 랭킹 ──────────────────────────────────────────────────── */

function RankingView() {
  const [scope, setScope] = useState<"주간" | "전체">("주간");
  return (
    <>
      <Header title="랭킹" action={<OpenFullTable href="/lab2/ranking" label="전체 표" />} />
      <div className="shrink-0 px-2 pb-2">
        <Toggle options={["주간", "전체"]} value={scope} onChange={(v) => setScope(v as never)} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {RANKING.map((r) => (
          <div
            key={r.user}
            className={`flex items-center gap-2 py-[4px] pl-3 pr-3 ${
              "me" in r && r.me ? "border-l-2 border-brand bg-elevated/40 pl-[10px]" : ""
            }`}
          >
            <span className="w-6 shrink-0 text-right font-mono text-[11px] tabular-nums text-faint">
              {r.rank}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{r.user}</span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-fg">{r.solved}</span>
          </div>
        ))}
      </div>
      <p className="shrink-0 border-t border-border px-4 py-2 text-[10px] leading-relaxed text-faint">
        랭킹은 M5 구현 예정 — 지금은 더미입니다
      </p>
    </>
  );
}

/* ── 검증 ──────────────────────────────────────────────────── */

function VerificationView({ activeId }: { activeId?: number }) {
  return (
    <>
      <Header title="검증" />
      <p className="shrink-0 px-4 pb-2 text-[11px] leading-relaxed text-faint">
        AI가 만든 문제가 어떤 검사를 통과했는지
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {VERIFIED_RECENT.map((v) => (
          <Row
            key={v.id}
            href={`/lab2/p/${v.id}/verification`}
            active={v.id === activeId}
            left={v.id}
            label={v.title}
            right={
              <span style={{ color: v.state === "게시됨" ? PASS : WARN }}>
                {v.state === "게시됨" ? "게시" : "대기"}
              </span>
            }
          />
        ))}
      </div>
    </>
  );
}

/* ── 조각들 ────────────────────────────────────────────────── */

function Row({
  href,
  active,
  left,
  label,
  right,
}: {
  href: string;
  active: boolean;
  left: number;
  label: string;
  right: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-2 py-[3px] pl-7 pr-2 transition-colors ${
        active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/60"
      }`}
    >
      <span className="w-9 shrink-0 font-mono text-[11px] tabular-nums text-faint">{left}</span>
      <span className="min-w-0 flex-1 truncate text-[13px]">{label}</span>
      {/* VS Code가 git 상태를 표시하던 자리 */}
      <span className="shrink-0 font-mono text-[10px] tracking-[0.06em]">{right}</span>
    </Link>
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
      className={`border px-1.5 py-[1px] font-mono text-[10px] tracking-[0.06em] transition-colors ${
        on
          ? "border-brand text-brand"
          : "border-border text-faint hover:border-border-strong hover:text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex border border-border">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`flex-1 py-[3px] text-[11px] transition-colors ${
            value === o ? "bg-elevated text-fg" : "text-faint hover:text-muted"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function VerdictDot({ verdict }: { verdict: Verdict }) {
  if (!verdict) {
    return (
      <span
        className="h-[7px] w-[7px] shrink-0 animate-pulse rounded-full"
        style={{ background: WARN }}
      />
    );
  }
  return (
    <span
      className="h-[7px] w-[7px] shrink-0 rounded-full"
      style={{ background: VERDICT_COLOR[verdict] }}
    />
  );
}
