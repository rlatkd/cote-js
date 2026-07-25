import { getProblems } from "@/entities/problem/api";
import HomeView from "@/views/home/HomeView";

// 서버 컴포넌트: 데이터 페칭 후 view에 전달 (RSC)
export default async function HomePage() {
  const problems = await getProblems();
  return <HomeView problems={problems} />;
}
