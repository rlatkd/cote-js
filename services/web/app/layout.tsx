import type { Metadata } from "next";
import "./globals.css";
import { pretendard, jetbrainsMono } from "./fonts";
import Navbar from "@/shared/ui/Navbar";
import { getSession } from "@/entities/auth/api";
import { logout } from "@/entities/auth/actions";

export const metadata: Metadata = {
  title: "CoteJS — AI 코딩 테스트 플랫폼",
  description: "AI가 생성하고 검증한 알고리즘 문제로 연습하는 코딩 테스트 플랫폼",
};

// 하이드레이션 전에 테마를 적용해 깜빡임(FOUC) 방지. 기본값은 라이트.
const themeScript = `
(function() {
  try {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 세션은 서버(RSC)가 조회한다 — httpOnly 쿠키는 클라이언트 JS가 읽을 수 없다(의도).
  // Navbar(shared)에는 데이터·액션만 내려보낸다(레이어 단방향 의존).
  const session = await getSession();
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${pretendard.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Navbar session={session} onLogout={logout} />
        {children}
      </body>
    </html>
  );
}
