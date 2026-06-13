import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/permissions";
import { listProjectMembersWithUser } from "@/lib/db/queries/members";
import { listUsers } from "@/lib/db/queries/users";
import { ProjectMemberManager } from "@/components/project-member-manager";

export default async function ProjectUsersPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  if (!canManageUsers(user)) redirect(`/projects/${projectId}`);

  const [members, allUsers] = await Promise.all([
    listProjectMembersWithUser(projectId),
    listUsers(),
  ]);
  const candidates = allUsers.filter((u) => u.role !== "admin");

  return <ProjectMemberManager projectId={projectId} members={members} candidates={candidates} />;
}
