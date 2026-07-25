import { getProblems } from "@/entities/problem/api";
import ProblemListView from "@/views/problem-list/ProblemListView";

export default async function ProblemsPage() {
  const problems = await getProblems();
  return <ProblemListView problems={problems} />;
}
