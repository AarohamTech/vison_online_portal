"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { files as filesTable, labelUploads } from "@/lib/db/schema";
import { loadAccessContext } from "@/lib/projects/access";
import {
  getExtension,
  isBlockedForNonAdmin,
  isImage,
  isLabel,
} from "@/lib/validation/files";
import { buildObjectKey, normalizeRelativePath, splitPath } from "@/lib/s3/keys";
import { signedUploadUrl } from "@/lib/s3/client";
import { logActivity } from "@/lib/db/queries/activity";
import { SECTION_SLUG } from "@/lib/sections";
import { effectiveAllowed, mimeFor } from "./upload-core";
import type { Section } from "@/types";

export interface UploadItemInput {
  /** Client-side id to correlate the response. */
  clientId: string;
  /** webkitRelativePath or just the file name. */
  relPath: string;
  size: number;
  type?: string;
}

export interface PreparedUpload {
  clientId: string;
  url: string;
  objectKey: string;
  fileName: string;
  folderPath: string;
  fileType: string;
  contentType: string;
  size: number;
}

export interface BlockedItem {
  clientId: string;
  fileName: string;
  reason: string;
}

export interface DuplicateItem {
  clientId: string;
  fileName: string;
  folderPath: string;
}

export interface PrepareResult {
  uploads: PreparedUpload[];
  blocked: BlockedItem[];
  duplicates: DuplicateItem[];
}

export type ConflictStrategy = "detect" | "replace" | "rename" | "skip";

async function keyExists(projectId: string, objectKey: string): Promise<boolean> {
  const rows = await db
    .select({ id: filesTable.id })
    .from(filesTable)
    .where(
      and(
        eq(filesTable.projectId, projectId),
        eq(filesTable.objectKey, objectKey),
        isNull(filesTable.deletedAt)
      )
    )
    .limit(1);
  return rows.length > 0;
}

function suffixName(fileName: string, n: number): string {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return `${fileName} (${n})`;
  return `${fileName.slice(0, dot)} (${n})${fileName.slice(dot)}`;
}

/**
 * Validate + generate signed PUT URLs for a batch of files.
 * Preserves folder structure from each item's relPath under destSubPath.
 */
export async function prepareUploads(
  projectId: string,
  section: Exclude<Section, "metadata">,
  destSubPath: string,
  items: UploadItemInput[],
  strategy: ConflictStrategy = "detect"
): Promise<PrepareResult> {
  const { user, membership } = await loadAccessContext(projectId);

  const allowed = effectiveAllowed(user, membership, section);
  if (allowed.size === 0) {
    return {
      uploads: [],
      blocked: items.map((it) => ({
        clientId: it.clientId,
        fileName: it.relPath.split("/").pop() ?? it.relPath,
        reason: "You do not have permission to upload to this section.",
      })),
      duplicates: [],
    };
  }

  const dest = normalizeRelativePath(destSubPath || "");
  const uploads: PreparedUpload[] = [];
  const blocked: BlockedItem[] = [];
  const duplicates: DuplicateItem[] = [];

  for (const it of items) {
    let rel: string;
    try {
      rel = normalizeRelativePath(it.relPath);
    } catch {
      blocked.push({ clientId: it.clientId, fileName: it.relPath, reason: "Invalid path." });
      continue;
    }
    const { folder, fileName } = splitPath(rel);
    if (!fileName) {
      blocked.push({ clientId: it.clientId, fileName: it.relPath, reason: "Invalid file name." });
      continue;
    }

    // Hard executable block for non-admins.
    if (user.role !== "admin" && isBlockedForNonAdmin(fileName)) {
      blocked.push({
        clientId: it.clientId,
        fileName,
        reason: "You do not have permission to upload installer or executable files.",
      });
      continue;
    }

    const ext = getExtension(fileName);
    if (!allowed.has(ext)) {
      blocked.push({
        clientId: it.clientId,
        fileName,
        reason: `Files of type ".${ext || "?"}" are not allowed here.`,
      });
      continue;
    }

    const subPath = [dest, folder].filter(Boolean).join("/");
    let finalName = fileName;
    let objectKey = buildObjectKey({
      projectId,
      section,
      subPath,
      fileName: finalName,
      userId: section === "annotated" ? user.id : undefined,
    });

    const exists = await keyExists(projectId, objectKey);
    if (exists) {
      if (strategy === "detect") {
        duplicates.push({ clientId: it.clientId, fileName, folderPath: subPath });
        continue;
      }
      if (strategy === "skip") continue;
      if (strategy === "rename") {
        let n = 1;
        do {
          finalName = suffixName(fileName, n++);
          objectKey = buildObjectKey({
            projectId, section, subPath, fileName: finalName,
            userId: section === "annotated" ? user.id : undefined,
          });
        } while (await keyExists(projectId, objectKey));
      }
      // strategy === "replace": keep same key (overwrite).
    }

    const contentType = mimeFor(finalName, it.type);
    const url = await signedUploadUrl(objectKey, contentType, 900);
    const folderPath = section === "annotated" ? [user.id, subPath].filter(Boolean).join("/") : subPath;

    uploads.push({
      clientId: it.clientId,
      url,
      objectKey,
      fileName: finalName,
      folderPath,
      fileType: ext,
      contentType,
      size: it.size,
    });
  }

  return { uploads, blocked, duplicates };
}

export interface ConfirmItem {
  objectKey: string;
  fileName: string;
  folderPath: string;
  fileType: string;
  contentType: string;
  size: number;
}

/** After successful S3 PUTs, persist file rows (+ label rows for annotated). */
export async function confirmUploads(
  projectId: string,
  section: Exclude<Section, "metadata">,
  bucket: string,
  items: ConfirmItem[]
): Promise<{ inserted: number }> {
  const { user, membership } = await loadAccessContext(projectId);
  const allowed = effectiveAllowed(user, membership, section);
  if (allowed.size === 0) return { inserted: 0 };

  let inserted = 0;
  for (const it of items) {
    if (!allowed.has(it.fileType)) continue; // defense-in-depth
    if (user.role !== "admin" && isBlockedForNonAdmin(it.fileName)) continue;

    const [row] = await db
      .insert(filesTable)
      .values({
        projectId,
        bucket,
        objectKey: it.objectKey,
        fileName: it.fileName,
        fileType: it.fileType,
        mimeType: it.contentType,
        size: it.size,
        section,
        folderPath: it.folderPath,
        uploadedBy: user.id,
      })
      .onConflictDoUpdate({
        target: filesTable.objectKey,
        set: { size: it.size, deletedAt: null, updatedAt: new Date() },
      })
      .returning();

    inserted++;

    if (section === "annotated" && isLabel(it.fileName) && row) {
      await db.insert(labelUploads).values({
        projectId,
        labelFileId: row.id,
        uploadedBy: user.id,
        status: "uploaded",
      });
      await logActivity({
        userId: user.id, action: "label_uploaded", projectId,
        targetType: "file", targetId: row.id, details: { fileName: it.fileName },
      });
    } else {
      await logActivity({
        userId: user.id,
        action: isImage(it.fileName) ? "file_uploaded" : "file_uploaded",
        projectId, targetType: "file", targetId: row?.id ?? null,
        details: { fileName: it.fileName, section },
      });
    }
  }

  revalidatePath(`/projects/${projectId}/${SECTION_SLUG[section]}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { inserted };
}
