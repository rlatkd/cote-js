import { getSubmissions } from "@/entities/submission/api";
import SubmissionStatusView from "@/views/submission-status/SubmissionStatusView";

export default async function StatusPage() {
  const submissions = await getSubmissions();
  return <SubmissionStatusView submissions={submissions} />;
}
