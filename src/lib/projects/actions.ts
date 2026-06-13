"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { canManageProjects } from "@/lib/permissions";
import { logActivity } from "@/lib/db/queries/activity";
import { putObject, S3_BUCKET } from "@/lib/s3/client";
import { metadataKey, projectPrefix } from "@/lib/s3/keys";
import { createProjectSchema } from "./schema";
import type { ProjectMetadata, ProjectStatus } from "@/types";

export interface CreateProjectState {
  error: string | null;
  fieldErrors?: Record<string, string[]>;
}

export async function createProjectAction(
  _prev: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
  const user = await requireUser();
  if (!canManageProjects(user)) {
    return { error: "You do not have permission to create projects." };
  }

  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    customerName: formData.get("customerName"),
    productName: formData.get("productName"),
    description: formData.get("description") ?? "",
    status: formData.get("status") ?? "active",
  });

  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const v = parsed.data;
  let newId: string | null = null;

  try {
    // 1) Create the project row.
    const [row] = await db
      .insert(projects)
      .values({
        name: v.name,
        customerName: v.customerName,
        productName: v.productName,
        description: v.description || null,
        status: v.status as ProjectStatus,
        createdBy: user.id,
      })
      .returning();
    newId = row.id;

    // 2) Write the fixed folder structure + metadata.json to S3.
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
      // Zero-byte markers so the fixed prefixes exist in the bucket.
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
    console.error("[createProject] failed", e);
    // Best-effort rollback of the DB row if S3 failed midway.
    if (newId) {
      try {
        await db.delete(projects).where(eq(projects.id, newId));
      } catch {
        /* leave for manual cleanup; logged above */
      }
    }
    return { error: "Failed to create project. Please try again." };
  }

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect(`/projects/${newId}`);
}
