import type { Metadata } from "next";
import MeView from "./MeView";

// 개인 화면은 색인 대상이 아니다 — 내용이 사람마다 다르고 로그인이 필요하다.
export const metadata: Metadata = {
  title: "마이페이지",
  robots: { index: false, follow: true },
};

export default function MePage() {
  return <MeView />;
}
