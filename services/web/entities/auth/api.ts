// auth Repository — 서버 전용(쿠키를 읽으므로 클라이언트 번들에 들어가면 안 된다).
// 세션의 진실원은 api의 httpOnly 쿠키다: web은 쿠키를 읽을 수 없고(httpOnly),
// 매 렌더마다 /auth/me로 "지금 로그인인가"를 물어본다.

import { cookies } from "next/headers";
import { API_URL } from "@/shared/api/client";

export type Session = {
  id: number;
  nickname: string;
  role: string;
};

/** 현재 세션 — 비로그인·만료는 null(예외가 아니라 일상 경로). */
export async function getSession(): Promise<Session | null> {
  const cookie = cookies().toString();
  if (!cookie) return null;
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      cache: "no-store",
      headers: { cookie },
    });
    if (!res.ok) return null;
    return (await res.json()) as Session;
  } catch {
    // api가 내려가 있어도 화면은 떠야 한다 — 비로그인으로 취급.
    return null;
  }
}
