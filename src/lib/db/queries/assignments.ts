import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { files, labelUploads, projectMembers, projects } from "@/lib/db/schema";
import type { Project } from "@/types";

const IMAGE_EXTS = ["jpg", "jpeg", "png", "bmp", "tif", "tiff", "webp"];

export interface Assignment {
  project: Pick<Project, "id" | "name" | "customerName" | "productName" | "status">;
  assignedPaths: string[];
  canDownload: boolean;
  canUploadImages: boolean;
  imageCount: number;
  myLabelCount: number;
}

export async function getMyAssignments(userId: string): Promise<Assignment[]> {
  const memberships = await db
    .select({ m: projectMembers, p: projects })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, userId));

  if (memberships.length === 0) return [];
  const ids = memberships.map((r) => r.p.id);

  const imageRows = await db
    .select({
      projectId: files.projectId,
      c: sql<number>`count(*) filter (where ${files.section} = 'train_data' and ${inArray(files.fileType, IMAGE_EXTS)})`,
    })
    .from(files)
    .where(and(inArray(files.projectId, ids), isNull(files.deletedAt)))
    .groupBy(files.projectId);
  const imageMap = new Map(imageRows.map((r) => [r.projectId, Number(r.c)]));

  const labelRows = await db
    .select({ projectId: labelUploads.projectId, c: sql<number>`count(*)` })
    .from(labelUploads)
    .where(and(inArray(labelUploads.projectId, ids), eq(labelUploads.uploadedBy, userId)))
    .groupBy(labelUploads.projectId);
  const labelMap = new Map(labelRows.map((r) => [r.projectId, Number(r.c)]));

  return memberships.map(({ m, p }) => ({
    project: {
      id: p.id, name: p.name, customerName: p.customerName,
      productName: p.productName, status: p.status,
    },
    assignedPaths: m.assignedPaths,
    canDownload: m.canDownload,
    canUploadImages: m.canUploadImages,
    imageCount: imageMap.get(p.id) ?? 0,
    myLabelCount: labelMap.get(p.id) ?? 0,
  }));
}
