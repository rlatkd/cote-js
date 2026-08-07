/**
 * 랩 네비 — 실제 서비스 라우트가 아니라 **랩 페이지끼리만** 오간다.
 * 본 서비스 적용은 디자인 의사결정이 끝난 뒤의 일이다.
 */
export default function LabNav({
  current,
  d,
  signedIn = true,
}: {
  current: "home" | "problems" | "status" | "verification" | "me";
  d: number;
  signedIn?: boolean;
}) {
  // 앞 셋은 본 서비스에도 있는 화면, 뒤 둘은 이번에 새로 제안한 화면.
  const links = [
    { key: "home", href: "/lab", label: "/home" },
    { key: "problems", href: "/lab/problems", label: "/problems" },
    { key: "status", href: "/lab/status", label: "/status" },
    { key: "verification", href: "/lab/verification", label: "/verification" },
    { key: "me", href: "/lab/me", label: "/mypage" },
  ] as const;

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur">
      <div
        className="mx-auto flex max-w-6xl items-center gap-7 px-5 text-[13px]"
        style={{ height: `${3.2 * d}rem` }}
      >
        <a href="/lab" className="flex items-center gap-1.5 text-[17px]">
          cote.js
          <span className="inline-block h-[13px] w-[7px] animate-blink bg-brand" />
        </a>
        <nav className="flex gap-5">
          {links.map((l) => (
            <a
              key={l.key}
              href={l.href}
              className={
                l.key === current ? "text-brand" : "text-faint transition-colors hover:text-fg"
              }
            >
              {l.label}
            </a>
          ))}
        </nav>
        {signedIn ? (
          <span className="ml-auto text-faint">@rlatkd</span>
        ) : (
          <a
            href="/lab/login"
            className="ml-auto border border-border-strong px-3 py-1 text-[12px] text-muted transition-colors hover:border-brand hover:text-brand"
          >
            로그인
          </a>
        )}
      </div>
    </header>
  );
}
