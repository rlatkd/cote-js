"use client";

// 세션 자동 복구 — access(1h)가 만료돼도 refresh(14d)가 살아 있으면 재로그인 없이 회전한다.
// 브라우저가 api를 **직접** 호출해야 하는 이유: refresh 쿠키는 path=/api/auth 한정이라
// Next 서버(:3000)로 오는 요청에는 아예 실리지 않는다(노출 최소화 설계의 대가 — ADR-0019).
// 204(회전 성공)면 서버 컴포넌트를 다시 렌더해 세션 표시를 되살린다. 401이면 그냥 비로그인.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { BROWSER_API_URL } from "@/shared/api/client";

export default function SessionRefresher() {
  const router = useRouter();
  const tried = useRef(false);

  useEffect(() => {
    if (tried.current) return; // 마운트당 1회 — 401 반복 호출 루프 방지
    tried.current = true;
    fetch(`${BROWSER_API_URL}/auth/refresh`, { method: "POST", credentials: "include" })
      .then((res) => {
        if (res.status === 204) router.refresh();
      })
      .catch(() => {
        // api 다운 — 비로그인 상태 유지가 올바른 폴백
      });
  }, [router]);

  return null;
}
