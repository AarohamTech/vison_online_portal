import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityLogs, files, labelUploads, profiles, projects } from "@/lib/db/schema";
import { accessibleProjectIds } from "./projects";
import type { ActivityLog } from "@/types";
import type { SessionUser } from "@/lib/auth/session";

const IMAGE_EXTS = ["jpg", "jpeg", "png", "bmp", "tif", "tiff", "webp"];

export interface DashboardStats {
  totalProjects: number;
  totalImages: number;
  totalLabels: number;
  pendingLabels: number;
  storageBytes: number;
}

export async function getDashboardStats(
  user: SessionUser
): Promise<DashboardStats> {
  const ids = await accessibleProjectIds(user);
  const empty: DashboardStats = {
    totalProjects: 0,
    totalImages: 0,
    totalLabels: 0,
    pendingLabels: 0,
    storageBytes: 0,
  };
  if (ids !== "all" && ids.length === 0) return empty;

  const scopeFiles =
    ids === "all" ? isNull(files.deletedAt) : and(isNull(files.deletedAt), inArray(files.projectId, ids));

  const [fileAgg] = await db
    .select({
      images: sql<number>`count(*) filter (where ${inArray(files.fileType, IMAGE_EXTS)})`,
      labels: sql<number>`count(*) filter (where ${files.section} = 'annotated')`,
      bytes: sql<number>`coalesce(sum(${files.size}), 0)`,
      projectsCount: sql<number>`count(distinct ${files.projectId})`,
    })
    .from(files)
    .where(scopeFiles);

  const scopeLabels =
    ids === "all"
      ? eq(labelUploads.status, "uploaded")
      : and(eq(labelUploads.status, "uploaded"), inArray(labelUploads.projectId, ids));

  const [labelAgg] = await db
    .select({ pending: sql<number>`count(*)` })
    .from(labelUploads)
    .where(scopeLabels);

  // total projects = number accessible (not just those with files)
  const totalProjects = ids === "all" ? await countAllProjects() : ids.length;

  return {
    totalProjects,
    totalImages: Number(fileAgg?.images ?? 0),
    totalLabels: Number(fileAgg?.labels ?? 0),
    pendingLabels: Number(labelAgg?.pending ?? 0),
    storageBytes: Number(fileAgg?.bytes ?? 0),
  };
}

async function countAllProjects(): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)` })
    .from(projects);
  return Number(row?.c ?? 0);
}

export interface ActivityWithUser extends ActivityLog {
  userName: string | null;
  userEmail: string | null;
}

export async function recentActivity(
  user: SessionUser,
  limit = 8
): Promise<ActivityWithUser[]> {
  const ids = await accessibleProjectIds(user);
  if (ids !== "all" && ids.length === 0) return [];

  const where =
    ids === "all" ? undefined : inArray(activityLogs.projectId, ids);

  const rows = await db
    .select({
      log: activityLogs,
      userName: profiles.fullName,
      userEmail: profiles.email,
    })
    .from(activityLogs)
    .leftJoin(profiles, eq(activityLogs.userId, profiles.id))
    .where(where)
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);

  return rows.map(({ log, userName, userEmail }) => ({
    id: log.id,
    projectId: log.projectId,
    userId: log.userId ?? "",
    action: log.action as ActivityLog["action"],
    targetType: log.targetType,
    targetId: log.targetId,
    details: log.details as Record<string, unknown> | null,
    createdAt: log.createdAt.toISOString(),
    userName,
    userEmail,
  }));
}

/** Activity for one project (admin view), newest first. */
export async function projectActivity(
  projectId: string,
  limit = 50
): Promise<ActivityWithUser[]> {
  const rows = await db
    .select({ log: activityLogs, userName: profiles.fullName, userEmail: profiles.email })
    .from(activityLogs)
    .leftJoin(profiles, eq(activityLogs.userId, profiles.id))
    .where(eq(activityLogs.projectId, projectId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);

  return rows.map(({ log, userName, userEmail }) => ({
    id: log.id,
    projectId: log.projectId,
    userId: log.userId ?? "",
    action: log.action as ActivityLog["action"],
    targetType: log.targetType,
    targetId: log.targetId,
    details: log.details as Record<string, unknown> | null,
    createdAt: log.createdAt.toISOString(),
    userName,
    userEmail,
  }));
}
