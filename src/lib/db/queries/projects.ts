import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { files, projectMembers, projects } from "@/lib/db/schema";
import type { Project } from "@/types";
import type { SessionUser } from "@/lib/auth/session";

type ProjectRow = typeof projects.$inferSelect;

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    customerName: row.customerName,
    productName: row.productName,
    description: row.description,
    status: row.status,
    createdBy: row.createdBy ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Project IDs the user can access (admins: all). */
export async function accessibleProjectIds(
  user: SessionUser
): Promise<string[] | "all"> {
  if (user.role === "admin") return "all";
  const rows = await db
    .select({ id: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, user.id));
  return rows.map((r) => r.id);
}

/** Per-project aggregate counts (images, labels, storage) for a set of ids. */
async function aggregatesFor(
  projectIds: string[] | "all"
): Promise<Map<string, { images: number; labels: number; bytes: number }>> {
  const imageExts = ["jpg", "jpeg", "png", "bmp", "tif", "tiff", "webp"];
  const whereLive = isNull(files.deletedAt);
  const where =
    projectIds === "all"
      ? whereLive
      : projectIds.length === 0
        ? sql`false`
        : and(whereLive, inArray(files.projectId, projectIds));

  const rows = await db
    .select({
      projectId: files.projectId,
      images: sql<number>`count(*) filter (where ${inArray(files.fileType, imageExts)})`,
      labels: sql<number>`count(*) filter (where ${files.section} = 'annotated')`,
      bytes: sql<number>`coalesce(sum(${files.size}), 0)`,
    })
    .from(files)
    .where(where)
    .groupBy(files.projectId);

  const map = new Map<string, { images: number; labels: number; bytes: number }>();
  for (const r of rows) {
    map.set(r.projectId, {
      images: Number(r.images),
      labels: Number(r.labels),
      bytes: Number(r.bytes),
    });
  }
  return map;
}

export async function listAccessibleProjects(
  user: SessionUser
): Promise<Project[]> {
  const ids = await accessibleProjectIds(user);
  if (ids !== "all" && ids.length === 0) return [];

  const rows = await db
    .select()
    .from(projects)
    .where(ids === "all" ? undefined : inArray(projects.id, ids))
    .orderBy(desc(projects.updatedAt));

  const agg = await aggregatesFor(ids);
  return rows.map((row) => {
    const a = agg.get(row.id);
    return {
      ...toProject(row),
      totalImages: a?.images ?? 0,
      totalLabels: a?.labels ?? 0,
      storageBytes: a?.bytes ?? 0,
    };
  });
}

export async function getProjectById(
  projectId: string
): Promise<Project | null> {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return rows[0] ? toProject(rows[0]) : null;
}

export async function recentProjects(
  user: SessionUser,
  limit = 5
): Promise<Project[]> {
  const all = await listAccessibleProjects(user);
  return all.slice(0, limit);
}
