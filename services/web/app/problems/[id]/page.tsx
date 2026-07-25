import { notFound } from "next/navigation";
import { getProblem } from "@/entities/problem/api";
import ProblemSolvingView from "@/views/problem-solving/ProblemSolvingView";

export default async function ProblemDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const problem = await getProblem(Number(params.id));
  if (!problem) notFound();

  // 통합 split view는 뷰포트를 꽉 채운다 (Navbar h-14 = 3.5rem 제외)
  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <ProblemSolvingView problem={problem} />
    </div>
  );
}
