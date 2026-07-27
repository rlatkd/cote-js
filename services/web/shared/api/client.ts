// api(백엔드) 접근 공용 헬퍼. 서버 컴포넌트에서 호출된다.
// 기본은 로컬 api. 배포 시 API_URL 환경변수로 주입.

const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * 브라우저가 직접 붙는 base(SSE 등). 서버 전용 `API_URL`과 달리 클라이언트 번들에
 * 들어가므로 `NEXT_PUBLIC_` 접두사가 필요하다.
 */
export const BROWSER_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`api GET ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** 404를 undefined로 흡수하는 GET(상세 조회용). */
export async function apiGetOptional<T>(path: string): Promise<T | undefined> {
  const res = await fetch(`${API_URL}/api${path}`, { cache: "no-store" });
  if (res.status === 404) return undefined;
  if (!res.ok) {
    throw new Error(`api GET ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}
