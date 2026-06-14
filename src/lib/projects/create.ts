import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { logActivity } from "@/lib/db/queries/activity";
import { putObject, S3_BUCKET } from "@/lib/s3/client";
import { metadataKey, projectPrefix } from "@/lib/s3/keys";
import type { CreateProjectValues } from "./schema";
import type { Project, ProjectMetadata, ProjectStatus } from "@/types";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Create a project + provision its fixed S3 folder structure + metadata.json.
 * Shared by the web server action and the REST API. Rolls back the DB row if
 * the S3 provisioning fails.
 */
export async function createProjectForUser(
  user: SessionUser,
  v: CreateProjectValues
): Promise<Project> {
  const [row] = await db
    .insert(projects)
    .values({
      name: v.name,
      customerName: v.customerName,
      productName: v.productName,
      description: v.description || null,
      status: (v.status as ProjectStatus) ?? "active",
      createdBy: user.id,
    })
    .returning();

  try {
    const now = row.createdAt.toISOString();
    const metadata: ProjectMetadata = {
      projectId: row.id,
      projectName: row.name,
      customerName: row.customerName,
      productName: row.productName,
      createdAt: now,
      updatedAt: now,
      createdBy: user.id,
      folderStructureVersion: "1.0",
    };
    const base = projectPrefix(row.id);
    await Promise.all([
      putObject(metadataKey(row.id), JSON.stringify(metadata, null, 2), "application/json"),
      putObject(`${base}installer/.keep`, Buffer.from(""), "text/plain"),
      putObject(`${base}train-data/raw/.keep`, Buffer.from(""), "text/plain"),
      putObject(`${base}annotated/final_labels/.keep`, Buffer.from(""), "text/plain"),
    ]);

    await logActivity({
      userId: user.id,
      action: "project_created",
      projectId: row.id,
      targetType: "project",
      targetId: row.id,
      details: { name: row.name, bucket: S3_BUCKET },
    });
  } catch (e) {
    await db.delete(projects).where(eq(projects.id, row.id)).catch(() => {});
    throw e;
  }

  return {
    id: row.id,
    name: row.name,
    customerName: row.customerName,
    productName: row.productName,
    description: row.description,
    status: row.status,
    createdBy: row.createdBy ?? user.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
