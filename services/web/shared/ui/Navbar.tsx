"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "/", label: "home" },
  { href: "/problems", label: "problems" },
  { href: "/status", label: "status" },
];

export default function Navbar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
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
          <button className="px-3 py-1.5 font-mono text-[13px] text-muted transition-colors hover:text-fg">
            로그인
          </button>
          <button className="bg-brand px-3.5 py-1.5 font-mono text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-hover">
            회원가입
          </button>
        </div>
      </div>
    </header>
  );
}
