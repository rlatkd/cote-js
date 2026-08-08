/**
 * lab2 레이아웃 — **server 컴포넌트**다. 크롬(상태·인터랙션)은 client인
 * [WorkspaceShell](./WorkspaceShell.tsx)이 맡고, 여기는 메타데이터만 담당한다.
 *
 * 왜 나눴나: `"use client"` 파일은 `metadata`를 export할 수 없다. 레이아웃까지
 * client로 두면 이 구역 전체가 제목·설명을 못 갖는다. 셸을 한 겹 안으로 밀어
 * 넣으면 **레이아웃과 각 page가 server로 남아** 메타데이터를 줄 수 있고, 인터랙션은
 * 그대로 동작한다(ADR-0004 "RSC는 정적 화면, 인터랙션은 client island"의 적용).
 *
 * 본 서비스로 옮길 때 이 구조를 그대로 쓴다.
 */

import type { Metadata } from "next";
import WorkspaceShell from "./WorkspaceShell";

export const metadata: Metadata = {
  // 하위 page가 title을 주면 "%s · cote.js"로 합쳐진다. 안 주면 default가 쓰인다.
  title: {
    template: "%s · cote.js",
    default: "cote.js — AI가 만들고 검증한 알고리즘 문제",
  },
  description:
    "AI가 만들고, 서로 모르는 독립 풀이들의 합의로 검증하고, 사람이 검수한 알고리즘 문제로 코딩 테스트를 준비하세요.",
};

export default function Lab2Layout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
