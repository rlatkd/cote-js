"use client";

/**
 * 점프 검색 — 번호나 제목을 알 때 바로 가는 자리(세 가지 검색 중 셋째).
 *
 * **커맨드 팔레트가 아니다.** 우리 서비스엔 "명령"이라는 개념이 없다 — 문제를 고르고
 * 코드를 쓰고 제출할 뿐이다. 그래서 `>` 같은 명령 접두어도, `Ctrl+P` 배지도 없고
 * 결과에는 **문제만** 나온다. (2026-08-08 사용자 지적: "우리 서비스에서 커맨드 같은
 * 건 있지 말아야 한다" — 없는 것을 있는 척하지 않는다는 원리의 적용)
 */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { PROBLEMS } from "./data";
import { TIER_COLOR } from "./theme";

export default function JumpSearch({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pool = needle
      ? PROBLEMS.filter(
          (p) => p.title.toLowerCase().includes(needle) || String(p.id).includes(needle),
        )
      : PROBLEMS;
    return pool.slice(0, 8);
  }, [q]);

  useEffect(() => setCursor(0), [q]);

  const go = (id: number) => {
    router.push(`/lab2/p/${id}`);
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(hits.length - 1, c + 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    }
    if (e.key === "Enter" && hits[cursor]) go(hits[cursor].id);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-center bg-black/40 pt-[60px]"
      onClick={onClose}
    >
      <div
        className="h-fit w-[min(90vw,560px)] border border-border-strong bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search size={13} className="shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="문제 번호 또는 제목"
            className="w-full bg-transparent text-[14px] text-fg outline-none placeholder:text-faint"
          />
        </div>

        <div className="max-h-[320px] overflow-y-auto py-1">
          {hits.map((p, i) => (
            <button
              key={p.id}
              onMouseEnter={() => setCursor(i)}
              onClick={() => go(p.id)}
              className={`flex w-full items-center gap-3 px-3 py-[6px] text-left transition-colors ${
                i === cursor ? "bg-elevated" : ""
              }`}
            >
              <span className="w-10 shrink-0 font-mono text-[12px] tabular-nums text-faint">
                {p.id}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{p.title}</span>
              <span
                className="shrink-0 font-mono text-[10px] tracking-[0.06em]"
                style={{ color: TIER_COLOR[p.group] }}
              >
                {p.tier}
              </span>
            </button>
          ))}
          {!hits.length && (
            <p className="px-3 py-6 text-center text-[12px] text-faint">
              일치하는 문제가 없습니다.
            </p>
          )}
        </div>

        <div className="border-t border-border px-3 py-1.5 text-[11px] text-faint">
          ↑↓ 이동 · Enter 열기 · Esc 닫기
        </div>
      </div>
    </div>
  );
}
