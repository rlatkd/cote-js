/**
 * 채점 현황 — **전체 공개 피드**의 대표 문서.
 *
 * 사이드바에도 같은 목록이 요약으로 있지만 240px에는 8열이 안 들어간다. 여기서
 * 전체를 편다(VS Code가 검색 결과에 쓰는 "편집기에서 열기" 구조).
 *
 * 이 문서가 없으면 채점 현황만 **URL이 없는 섹션**이 된다 — 액티비티 바를 링크로
 * 만드는 순간 링크할 곳이 없어지고, 크롤러도 도달하지 못한다(2026-08-08 ⓐ 채택).
 *
 * 내 제출 이력은 여기 없다 — 마이페이지 전용이라 역할을 겹치지 않게 한다.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Circle } from "lucide-react";
import { FEED } from "../data";
import { PASS, FAIL, WARN } from "../theme";

// server 컴포넌트라 메타데이터를 줄 수 있다(`"use client"`였으면 불가).
export const metadata: Metadata = {
  title: "채점 현황",
  description: "지금 채점 중인 제출과 최근 결과를 실시간으로 확인하세요.",
};

const VERDICT_COLOR: Record<string, string> = { AC: PASS, WA: FAIL, TLE: WARN };
const VERDICT_LABEL: Record<string, string> = {
  AC: "맞았습니다",
  WA: "틀렸습니다",
  TLE: "시간 초과",
};

export default function StatusPage() {
  const judging = FEED.filter((s) => !s.verdict).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-4 border-b border-border px-6 py-3">
        <p className="text-[13px] text-muted">모두의 제출이 실시간으로 흐릅니다</p>
        <span className="flex items-center gap-1.5 font-mono text-[11px]" style={{ color: WARN }}>
          <Circle size={7} className="animate-pulse fill-current" />
          채점 중 {judging}건
        </span>
        <span className="ml-auto font-mono text-[11px] text-faint">
          코드는 공개되지 않습니다
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full font-mono text-[12px]">
          <thead className="sticky top-0 bg-bg">
            <tr className="border-b border-border text-[11px] uppercase tracking-[0.1em] text-faint">
              <Th className="w-20 pl-6">제출 번호</Th>
              <Th className="w-24">사용자</Th>
              <Th className="w-16">문제</Th>
              <Th>제목</Th>
              <Th className="w-32">결과</Th>
              <Th className="w-24">언어</Th>
              <Th className="w-20 text-right">시간</Th>
              <Th className="w-24 text-right">메모리</Th>
              <Th className="w-24 pr-6 text-right">제출 시각</Th>
            </tr>
          </thead>
          <tbody>
            {FEED.map((s) => (
              <tr
                key={s.id}
                className={`border-b border-border/60 transition-colors hover:bg-elevated/40 ${
                  s.verdict ? "" : "bg-elevated/30"
                }`}
              >
                <Td className="pl-6 text-faint">{s.id}</Td>
                <Td className="text-muted">{s.user}</Td>
                <Td className="text-muted">
                  <Link href={`/lab2/p/${s.problem}`} className="hover:text-brand">
                    {s.problem}
                  </Link>
                </Td>
                <Td className="truncate">
                  <Link href={`/lab2/p/${s.problem}`} className="text-fg hover:text-brand">
                    {s.title}
                  </Link>
                </Td>
                <Td>
                  {s.verdict ? (
                    <span style={{ color: VERDICT_COLOR[s.verdict] }}>
                      {VERDICT_LABEL[s.verdict]}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5" style={{ color: WARN }}>
                      <Circle size={7} className="animate-pulse fill-current" />
                      채점 중 {s.progress}
                    </span>
                  )}
                </Td>
                <Td className="text-muted">{s.lang}</Td>
                <Td className="text-right tabular-nums text-muted">
                  {s.verdict ? `${s.ms} ms` : "—"}
                </Td>
                <Td className="text-right tabular-nums text-muted">
                  {s.verdict ? `${(s.kb / 1024).toFixed(1)} MB` : "—"}
                </Td>
                <Td className="pr-6 text-right tabular-nums text-muted">{s.at}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="shrink-0 border-t border-border px-6 py-1.5 font-mono text-[11px] text-faint">
        총 {FEED.length}건 · SSE로 실시간 갱신
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`py-2 text-left font-normal ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-[7px] ${className}`}>{children}</td>;
}
