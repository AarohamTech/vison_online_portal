import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/permissions";
import { listUsersWithProjectCounts } from "@/lib/db/queries/users";
import { UsersManager } from "@/components/users-manager";

export default async function UsersPage() {
  const user = await requireUser();
  if (!canManageUsers(user)) redirect("/dashboard");
  const users = await listUsersWithProjectCounts();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage accounts and roles across the platform.
        </p>
      </div>
      <UsersManager users={users} currentUserId={user.id} />
    </div>
  );
}
