import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/permissions";
import { projectActivity } from "@/lib/db/queries/stats";
import { ActivityLogTable } from "@/components/activity-log-table";

export default async function ProjectActivityPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  if (!canManageUsers(user)) redirect(`/projects/${projectId}`);
  const items = await projectActivity(projectId, 100);

  return <ActivityLogTable items={items} />;
}
