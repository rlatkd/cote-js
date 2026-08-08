import type { Metadata } from "next";
import RankingView from "./RankingView";

export const metadata: Metadata = {
  title: "랭킹",
  description: "해결한 문제 수 기준 랭킹. 동점이면 정답률 순입니다.",
};

export default function RankingPage() {
  return <RankingView />;
}
