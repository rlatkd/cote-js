"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import ThemeToggle from "./ThemeToggle";
import { BROWSER_API_URL } from "@/shared/api/client";

const links = [
  { href: "/", label: "home" },
  { href: "/problems", label: "problems" },
  { href: "/status", label: "status" },
];

/**
 * 세션은 layout(서버)이 조회해 props로 내려준다 — shared 레이어는 entities를
 * import할 수 없으므로(단방향 의존) 데이터만 받는다. 로그아웃도 같은 이유로
 * Server Action을 props로 주입받는다.
 */
type Props = {
  session: { nickname: string } | null;
  onLogout: () => Promise<void>;
};

export default function Navbar({ session, onLogout }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function logout() {
    startTransition(async () => {
      await onLogout();
      router.refresh(); // 서버 컴포넌트 재렌더 → 세션 표시 갱신
    });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4">
        {/* 터미널 워드마크 */}
        <Link
          href="/"
          className="flex items-center font-mono text-sm font-bold tracking-tight"
        >
          <span className="text-fg">cote</span>
          <span className="text-brand">.js</span>
          <span className="ml-0.5 h-4 w-[7px] animate-blink bg-brand" aria-hidden />
        </Link>

        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`relative px-2.5 py-1.5 font-mono text-[13px] tracking-tight transition-colors ${
                  active ? "text-fg" : "text-muted hover:text-fg"
                }`}
              >
                <span className="text-faint">/</span>
                {l.label}
                {active && (
                  <span className="absolute inset-x-2.5 -bottom-[13px] h-[2px] bg-brand" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          {session ? (
            <>
              <span className="px-2 font-mono text-[13px] text-fg">
                <span className="text-faint">@</span>
                {session.nickname}
              </span>
              <button
                onClick={logout}
                disabled={pending}
                className="px-3 py-1.5 font-mono text-[13px] text-muted transition-colors hover:text-fg disabled:opacity-50"
              >
                {pending ? "로그아웃…" : "로그아웃"}
              </button>
            </>
          ) : (
            // OAuth 단독(ADR-0019) — 가입=로그인이라 버튼은 하나다. 전체 페이지 이동으로
            // api → 카카오 → api 콜백 → 쿠키 발급 → 여기로 복귀.
            <a
              href={`${BROWSER_API_URL}/auth/login/kakao`}
              className="bg-brand px-3.5 py-1.5 font-mono text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
            >
              카카오 로그인
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
