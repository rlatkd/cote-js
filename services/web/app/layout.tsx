import type { Metadata } from "next";
import "./globals.css";
import { pretendard, jetbrainsMono } from "./fonts";
import Navbar from "@/shared/ui/Navbar";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <Navbar />
        {children}
      </body>
    </html>
  );
}
