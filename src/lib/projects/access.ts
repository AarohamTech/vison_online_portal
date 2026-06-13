import "server-only";
import { requireUser, type SessionUser } from "@/lib/auth/session";
import { getMembership } from "@/lib/db/queries/members";
import { canAccessProject, canViewSection } from "@/lib/permissions";
import type { ProjectMember, Section } from "@/types";

export interface AccessContext {
  user: SessionUser;
  membership: ProjectMember | null;
}

/** Load the current user + their membership for a project. */
export async function loadAccessContext(
  projectId: string
): Promise<AccessContext> {
  const user = await requireUser();
  const membership = await getMembership(projectId, user.id);
  return { user, membership };
}

/** Throws if the user cannot access the project. */
export async function assertProjectAccess(
  projectId: string
): Promise<AccessContext> {
  const ctx = await loadAccessContext(projectId);
  if (!canAccessProject(ctx.user, ctx.membership)) {
    throw new Error("Forbidden: no access to this project.");
  }
  return ctx;
}

/** Throws if the user cannot view the given section of the project. */
export async function assertSectionAccess(
  projectId: string,
  section: Section
): Promise<AccessContext> {
  const ctx = await assertProjectAccess(projectId);
  if (!canViewSection(ctx.user, ctx.membership, section)) {
    throw new Error("Forbidden: no access to this section.");
  }
  return ctx;
}
