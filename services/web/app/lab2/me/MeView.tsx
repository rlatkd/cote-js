"use client";

/**
 * 마이페이지 — 개인 지표 + **내 제출 이력**.
 *
 * 내 이력이 여기에만 있는 이유(2026-08-08 확정): 채점 현황은 **전체 공개 피드** 전용이라
 * 역할을 겹치지 않게 한다. 액티비티 바에서 이 메뉴를 고르면 사이드바가 접힌다 —
 * 띄울 목록이 없기 때문이고, 덕분에 화면을 넓게 쓴다.
 */

import Link from "next/link";
import { ACTIVITY_30D, MY_SUBMISSIONS, PROBLEMS } from "../data";
import { PASS, FAIL, WARN } from "../theme";
import { useWorkspace } from "../workspace";

const VERDICT_COLOR: Record<string, string> = { AC: PASS, WA: FAIL, TLE: WARN };
const VERDICT_LABEL: Record<string, string> = {
  AC: "맞았습니다",
  WA: "틀렸습니다",
  TLE: "시간 초과",
};

export default function MeView() {
  const { prefs } = useWorkspace();
  const max = Math.max(...ACTIVITY_30D);
  const solved = PROBLEMS.filter((p) => p.verdict === "AC").length;

  if (!prefs.signedIn) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[14px] text-muted">로그인하면 내 기록을 볼 수 있습니다.</p>
        <p className="text-[12px] text-faint">
          문제 읽기와 예제 실행은 로그인 없이도 됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-10 py-10">
        <h1 className="font-mono text-[20px] tracking-tight">@sanghun</h1>

        <div className="mt-8 grid gap-px bg-border sm:grid-cols-4">
          {[
            { k: "해결", v: String(solved) },
            { k: "제출", v: String(MY_SUBMISSIONS.length) },
            { k: "정답률", v: "36.7%" },
            { k: "연속", v: "12일" },
          ].map((s) => (
            <div key={s.k} className="bg-surface px-5 py-4">
              <div className="font-mono text-[24px] tabular-nums leading-none">{s.v}</div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.12em] text-faint">{s.k}</div>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-[11px] uppercase tracking-[0.12em] text-faint">최근 30일</h2>
        <div className="mt-3 flex h-16 items-end gap-[3px]">
          {ACTIVITY_30D.map((v, i) => (
            <div
              key={i}
              className="flex-1 bg-brand transition-opacity"
              style={{
                height: `${Math.max(6, (v / max) * 100)}%`,
                opacity: v === 0 ? 0.12 : 0.35 + (v / max) * 0.65,
              }}
              title={`${v}건`}
            />
          ))}
        </div>

        <h2 className="mt-10 text-[11px] uppercase tracking-[0.12em] text-faint">내 제출 이력</h2>
        <div className="mt-3 font-mono text-[12px]">
          {MY_SUBMISSIONS.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-4 border-b border-border/60 py-[7px] last:border-0"
            >
              <span className="w-14 shrink-0 text-faint">#{s.id}</span>
              <span className="w-20 shrink-0" style={{ color: VERDICT_COLOR[s.verdict!] }}>
                {VERDICT_LABEL[s.verdict!]}
              </span>
              <Link
                href={`/lab2/p/${s.problem}`}
                className="min-w-0 flex-1 truncate text-muted transition-colors hover:text-fg"
              >
                <span className="text-faint">{s.problem}</span> {s.title}
              </Link>
              <span className="w-20 shrink-0 text-faint">{s.lang}</span>
              <span className="w-16 shrink-0 text-right tabular-nums text-muted">{s.ms} ms</span>
              <span className="w-20 shrink-0 text-right tabular-nums text-faint">{s.at}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
