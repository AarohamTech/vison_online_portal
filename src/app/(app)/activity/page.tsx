import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/permissions";
import { recentActivity } from "@/lib/db/queries/stats";
import { ActivityLogTable } from "@/components/activity-log-table";

export default async function ActivityPage() {
  const user = await requireUser();
  if (!canManageUsers(user)) redirect("/dashboard");
  const items = await recentActivity(user, 100);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity Logs</h1>
        <p className="text-sm text-muted-foreground">Recent actions across all projects.</p>
      </div>
      <ActivityLogTable items={items} showProject />
    </div>
  );
}
