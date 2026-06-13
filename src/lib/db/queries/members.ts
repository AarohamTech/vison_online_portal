import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, projectMembers } from "@/lib/db/schema";
import type { ProjectMember } from "@/types";

type MemberRow = typeof projectMembers.$inferSelect;

function toMember(row: MemberRow): ProjectMember {
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    role: row.role,
    canDownload: row.canDownload,
    canUploadImages: row.canUploadImages,
    assignedPaths: row.assignedPaths,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The user's membership in a project, or null. */
export async function getMembership(
  projectId: string,
  userId: string
): Promise<ProjectMember | null> {
  const rows = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    )
    .limit(1);
  return rows[0] ? toMember(rows[0]) : null;
}

export async function listProjectMembers(
  projectId: string
): Promise<ProjectMember[]> {
  const rows = await db
    .select()
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId));
  return rows.map(toMember);
}

export interface MemberWithUser extends ProjectMember {
  email: string;
  fullName: string | null;
}

export async function listProjectMembersWithUser(
  projectId: string
): Promise<MemberWithUser[]> {
  const rows = await db
    .select({ member: projectMembers, email: profiles.email, fullName: profiles.fullName })
    .from(projectMembers)
    .innerJoin(profiles, eq(projectMembers.userId, profiles.id))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(asc(profiles.email));
  return rows.map((r) => ({ ...toMember(r.member), email: r.email, fullName: r.fullName }));
}
