// 서체 정의 — next/font로 셀프 호스팅(레이아웃 시프트 0, 외부 요청 없음).
// UI: Pretendard(한글+라틴 동시 대응, 한국어 개발 도구에 최적).
// 코드/수치: JetBrains Mono(에디터·정답률·번호 등 등폭 정체성).
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";

export const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920", // 변수 폰트 가중치 범위
  variable: "--font-sans",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700"],
  variable: "--font-mono",
});
