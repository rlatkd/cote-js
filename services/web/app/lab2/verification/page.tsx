/**
 * 검증 — 섹션의 대표 문서. 어떤 문제가 어떤 검사를 통과했는지 한눈에.
 *
 * 개별 리포트는 `/lab2/p/[id]/verification`이고, 여기는 그 목록이다. 이 문서가
 * 없으면 검증도 URL 없는 섹션이 된다(2026-08-08 ⓐ 채택).
 *
 * 우리 제품의 차별점이 **콘텐츠로** 드러나는 자리이기도 하다 — "AI가 만들었지만
 * 이렇게 검사했다"를 문제별로 보여준다.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { PROBLEMS, VERIFIED_RECENT } from "../data";
import { PASS, WARN, TIER_COLOR } from "../theme";

export const metadata: Metadata = {
  title: "검증",
  description:
    "AI가 만든 문제를 어떻게 검증하는지 — 독립 풀이 합의, 실채점, 사람 검수까지의 공정과 결과를 공개합니다.",
};

export default function VerificationsPage() {
  const published = VERIFIED_RECENT.filter((v) => v.state === "게시됨").length;
  const pending = VERIFIED_RECENT.length - published;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} style={{ color: PASS }} />
          <h1 className="text-[15px] text-fg">검증</h1>
        </div>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-muted">
          AI가 낸 초안을 그대로 믿지 않습니다. 지문만 보고 만든 독립 풀이 여러 개를 실제
          채점기로 돌려 답이 합의되는지 확인하고, 통과한 것만 사람 검수를 거쳐 게시합니다.
        </p>
        <div className="mt-4 flex gap-px bg-border">
          <Stat label="게시됨" value={String(published)} />
          <Stat label="검수 대기" value={String(pending)} accent />
          <Stat label="합의 정족수" value="n−1" />
          <Stat label="자동 검증 통과율" value="92%" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full font-mono text-[12px]">
          <thead className="sticky top-0 bg-bg">
            <tr className="border-b border-border text-[11px] uppercase tracking-[0.1em] text-faint">
              <th className="w-20 py-2 pl-6 text-left font-normal">번호</th>
              <th className="py-2 text-left font-normal">제목</th>
              <th className="w-28 py-2 text-left font-normal">티어</th>
              <th className="w-24 py-2 text-center font-normal">합의</th>
              <th className="w-28 py-2 text-left font-normal">상태</th>
              <th className="w-24 py-2 pr-6 text-right font-normal">리포트</th>
            </tr>
          </thead>
          <tbody>
            {VERIFIED_RECENT.map((v) => {
              const p = PROBLEMS.find((x) => x.id === v.id);
              const done = v.state === "게시됨";
              return (
                <tr
                  key={v.id}
                  className="border-b border-border/60 transition-colors hover:bg-elevated/40"
                >
                  <td className="py-[7px] pl-6 text-faint">{v.id}</td>
                  <td className="py-[7px] text-fg">{v.title}</td>
                  <td className="py-[7px]" style={{ color: p ? TIER_COLOR[p.group] : undefined }}>
                    {p?.tier ?? "—"}
                  </td>
                  <td className="py-[7px] text-center" style={{ color: PASS }}>
                    3/3
                  </td>
                  <td className="py-[7px]">
                    <span
                      className="flex items-center gap-1.5"
                      style={{ color: done ? PASS : WARN }}
                    >
                      {done ? <CheckCircle2 size={11} /> : <Info size={11} />}
                      {v.state}
                    </span>
                  </td>
                  <td className="py-[7px] pr-6 text-right">
                    <Link
                      href={`/lab2/p/${v.id}/verification`}
                      className="text-faint transition-colors hover:text-brand"
                    >
                      보기 →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="shrink-0 border-t border-border px-6 py-1.5 font-mono text-[11px] text-faint">
        검수 대기 {pending}건은 아직 게시되지 않았습니다
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex-1 bg-surface px-4 py-2.5">
      <div
        className={`font-mono text-[18px] tabular-nums leading-none ${accent ? "text-brand" : ""}`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-faint">{label}</div>
    </div>
  );
}
