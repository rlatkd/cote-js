import type { Metadata } from "next";
import { PROBLEMS, problemById, statementOf } from "../../data";
import SolveView from "./SolveView";

/**
 * **문제 상세가 우리 검색 자산의 거의 전부다.** 그래서 제목·설명이 문제마다 달라야
 * 하고, 그러려면 이 파일이 server 컴포넌트여야 한다(`"use client"`는 메타데이터를
 * export할 수 없다). 에디터·패널 같은 인터랙션은 SolveView가 맡는다.
 */
export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const p = problemById(Number(params.id));
  if (!p) return { title: "문제를 찾을 수 없습니다" };

  const s = statementOf(p.id);
  return {
    title: `${p.id} ${p.title}`,
    // 지문 도입부를 설명으로 — 검색 결과에 실제 문제 내용이 보인다.
    description: `${p.tier} · ${p.tags.join(", ")} · 정답률 ${p.rate}%. ${s.intro}`,
    openGraph: {
      title: `${p.id} ${p.title} · cote.js`,
      description: s.intro,
      type: "article",
    },
  };
}

/** 문제 URL을 미리 알려 크롤러가 액티비티 바(내비게이션) 없이도 도달하게 한다. */
export function generateStaticParams() {
  return PROBLEMS.map((p) => ({ id: String(p.id) }));
}

export default function SolvePage({ params }: { params: { id: string } }) {
  return <SolveView id={Number(params.id)} />;
}
