import type { Metadata } from "next";
import ProblemsView from "./ProblemsView";

export const metadata: Metadata = {
  title: "문제 목록",
  description:
    "티어·태그·정답률로 조건을 걸어 문제를 찾으세요. 모두 AI가 만들고 독립 풀이 합의로 검증한 문제입니다.",
};

export default function ProblemsPage() {
  return <ProblemsView />;
}
