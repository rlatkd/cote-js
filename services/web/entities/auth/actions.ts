"use server";

// 로그아웃 Server Action — 세션 쿠키를 지운다.
// 쿠키는 api(localhost:4000)가 심었지만 host-only('localhost')라 Next(3000)도 같은
// 이름·경로로 만료시킬 수 있다(로컬 개발 전제 — 배포에서 도메인이 갈리면 재검토, ADR-0019).

import { cookies } from "next/headers";
import { API_URL } from "@/shared/api/client";

export async function logout(): Promise<void> {
  const jar = cookies();
  // api 쪽 정리(모범 절차) — 실패해도 쿠키 만료만으로 로그아웃은 성립한다.
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: { cookie: jar.toString() },
    });
  } catch {
    // api 다운 중에도 로그아웃은 돼야 한다
  }
  jar.set("access_token", "", { path: "/", maxAge: 0 });
  jar.set("refresh_token", "", { path: "/api/auth", maxAge: 0 });
}
