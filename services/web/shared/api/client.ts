// api(백엔드) 접근 공용 헬퍼. Next 서버(서버 컴포넌트·Server Action)에서 호출된다.
// 기본은 로컬 api. 배포 시 API_URL 환경변수로 주입.
//
// 모든 요청에 traceparent를 실어 보낸다 — api·judge 로그와 같은 trace_id로 이어져
// "이 화면의 이 요청"을 전 구간에서 찾아갈 수 있다(ADR-0017).

import { currentTraceparent } from "./trace";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * 브라우저가 직접 붙는 base(SSE 등). 서버 전용 `API_URL`과 달리 클라이언트 번들에
 * 들어가므로 `NEXT_PUBLIC_` 접두사가 필요하다.
 */
export const BROWSER_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    cache: "no-store",
    headers: { traceparent: currentTraceparent() },
  });
  if (!res.ok) {
    throw new Error(`api GET ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** 404를 undefined로 흡수하는 GET(상세 조회용). */
export async function apiGetOptional<T>(path: string): Promise<T | undefined> {
  const res = await fetch(`${API_URL}/api${path}`, {
    cache: "no-store",
    headers: { traceparent: currentTraceparent() },
  });
  if (res.status === 404) return undefined;
  if (!res.ok) {
    throw new Error(`api GET ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** POST — Server Action에서 호출한다. 요청·응답 모두 JSON. */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const traceparent = currentTraceparent();
  // 쓰기 요청은 Next 서버 콘솔에도 남긴다 — 여기 찍힌 trace로 api·judge 로그를 찾아간다.
  console.log(`[web→api] POST ${path} traceparent=${traceparent}`);
  const res = await fetch(`${API_URL}/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", traceparent },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`api POST ${path} → ${res.status} (trace ${traceparent})`);
  }
  return res.json() as Promise<T>;
}
