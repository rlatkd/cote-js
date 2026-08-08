"use client";

/** 랭킹 전체 표 — 사이드바 요약의 "편집기에서 열기" 대상. M5(Redis sorted set) 구현 전이라 더미. */

import { useState } from "react";
import { RANKING } from "../data";
import { PASS } from "../theme";

export default function RankingView() {
  const [scope, setScope] = useState<"주간" | "월간" | "전체">("주간");

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-4 border-b border-border px-6 py-3">
        <div className="flex border border-border">
          {(["주간", "월간", "전체"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-3 py-[3px] text-[12px] transition-colors ${
                scope === s ? "bg-elevated text-fg" : "text-faint hover:text-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-faint">해결한 문제 수 기준 · 동점이면 정답률 순</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full font-mono text-[12px]">
          <thead className="sticky top-0 bg-bg">
            <tr className="border-b border-border text-[11px] uppercase tracking-[0.1em] text-faint">
              <th className="w-20 py-2 pl-6 text-left font-normal">순위</th>
              <th className="py-2 text-left font-normal">사용자</th>
              <th className="w-28 py-2 text-right font-normal">해결</th>
              <th className="w-28 py-2 pr-6 text-right font-normal">정답률</th>
            </tr>
          </thead>
          <tbody>
            {RANKING.map((r) => {
              const me = "me" in r && r.me;
              return (
                <tr
                  key={r.user}
                  className={`border-b border-border/60 transition-colors hover:bg-elevated/40 ${
                    me ? "bg-elevated/40" : ""
                  }`}
                >
                  <td className="py-[7px] pl-6 tabular-nums text-faint">
                    {me && <span className="mr-2 text-brand">▸</span>}
                    {r.rank}
                  </td>
                  <td className={`py-[7px] ${me ? "text-brand" : "text-fg"}`}>{r.user}</td>
                  <td className="py-[7px] text-right tabular-nums text-muted">{r.solved}</td>
                  <td className="py-[7px] pr-6 text-right tabular-nums text-muted">{r.rate}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="shrink-0 border-t border-border px-6 py-1.5 font-mono text-[11px] text-faint">
        <span style={{ color: PASS }}>●</span> 랭킹은 M5(Redis sorted set) 구현 예정 — 지금 값은
        더미입니다
      </div>
    </div>
  );
}
