/**
 * 홈 라우트 — **server 컴포넌트**. 메타데이터만 담당하고 화면은 client에 위임한다.
 *
 * 이 두 겹이 lab2 전체의 패턴이다: `page.tsx`(server, 메타데이터) + `*View.tsx`
 * (client, 인터랙션). 페이지를 통째로 `"use client"`로 두면 검색엔진에 줄 제목·설명이
 * 사라진다(SEO). 본 서비스로 옮길 때 이 구조를 그대로 쓴다.
 */

import HomeView from "./HomeView";

// 레이아웃의 default title을 그대로 쓴다(홈은 "홈 · cote.js"보다 서비스명이 낫다).
export default function HomePage() {
  return <HomeView />;
}
