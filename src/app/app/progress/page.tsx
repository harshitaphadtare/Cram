import { requireUser } from "@/lib/auth";
import { ProgressView } from "@/components/progress/progress-view";

export default async function ProgressPage() {
  const user = await requireUser();
  return <ProgressView user={user} />;
}
