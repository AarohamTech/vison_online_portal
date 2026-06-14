import "server-only";
import { db } from "@/lib/db";
import { files as filesTable, labelUploads } from "@/lib/db/schema";
import {
  IMAGE_EXTENSIONS,
  LABEL_EXTENSIONS,
  INSTALLER_EXTENSIONS,
  getExtension,
  isBlockedForNonAdmin,
  isLabel,
} from "@/lib/validation/files";
import {
  canUploadImages,
  canUploadLabels,
  canManageInstaller,
} from "@/lib/permissions";
import { buildObjectKey, normalizeRelativePath, splitPath } from "@/lib/s3/keys";
import { putObject, S3_BUCKET } from "@/lib/s3/client";
import { logActivity } from "@/lib/db/queries/activity";
import { toFileItem } from "@/lib/db/queries/files";
import type { Membership } from "@/lib/permissions";
import type { FileItem, Section } from "@/types";
import type { SessionUser } from "@/lib/auth/session";

const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", bmp: "image/bmp",
  tif: "image/tiff", tiff: "image/tiff", webp: "image/webp",
  json: "application/json", xml: "application/xml", csv: "text/csv",
  txt: "text/plain", yaml: "text/yaml", yml: "text/yaml", md: "text/markdown",
  zip: "application/zip", "7z": "application/x-7z-compressed", rar: "application/vnd.rar",
};

export function mimeFor(name: string, fallback?: string): string {
  return MIME[getExtension(name)] ?? fallback ?? "application/octet-stream";
}

/** Extensions a user may upload into a section, given their membership. */
export function effectiveAllowed(
  user: SessionUser,
  membership: Membership,
  section: Section
): Set<string> {
  const set = new Set<string>();
  if (section === "installer") {
    if (canManageInstaller(user)) INSTALLER_EXTENSIONS.forEach((e) => set.add(e));
    return set;
  }
  if (canUploadLabels(user, membership)) LABEL_EXTENSIONS.forEach((e) => set.add(e));
  if (canUploadImages(user, membership)) IMAGE_EXTENSIONS.forEach((e) => set.add(e));
  return set;
}

export interface StoreFileInput {
  projectId: string;
  section: Exclude<Section, "metadata">;
  /** Destination subfolder within the section (optional). */
  destPath?: string;
  /** Original name or relative path (folder structure preserved). */
  relPath: string;
  bytes: Buffer | Uint8Array;
  contentType?: string;
}

export class UploadRejectedError extends Error {}

/**
 * Server-side single-file upload: validates, writes bytes to S3, records the
 * DB row, and logs activity. Used by the REST API (direct multipart upload).
 * Throws UploadRejectedError when the file is not permitted.
 */
export async function storeUploadedFile(
  user: SessionUser,
  membership: Membership,
  input: StoreFileInput
): Promise<FileItem> {
  const allowed = effectiveAllowed(user, membership, input.section);
  if (allowed.size === 0) {
    throw new UploadRejectedError("You cannot upload to this section.");
  }

  const rel = normalizeRelativePath(input.relPath);
  const { folder, fileName } = splitPath(rel);
  if (!fileName) throw new UploadRejectedError("Invalid file name.");

  if (user.role !== "admin" && isBlockedForNonAdmin(fileName)) {
    throw new UploadRejectedError(
      "You do not have permission to upload installer or executable files."
    );
  }

  const ext = getExtension(fileName);
  if (!allowed.has(ext)) {
    throw new UploadRejectedError(`Files of type ".${ext || "?"}" are not allowed here.`);
  }

  const dest = input.destPath ? normalizeRelativePath(input.destPath) : "";
  const subPath = [dest, folder].filter(Boolean).join("/");
  const objectKey = buildObjectKey({
    projectId: input.projectId,
    section: input.section,
    subPath,
    fileName,
    userId: input.section === "annotated" ? user.id : undefined,
  });

  const contentType = mimeFor(fileName, input.contentType);
  await putObject(objectKey, input.bytes, contentType);

  const folderPath =
    input.section === "annotated" ? [user.id, subPath].filter(Boolean).join("/") : subPath;
  const size = input.bytes instanceof Buffer ? input.bytes.length : input.bytes.byteLength;

  const [row] = await db
    .insert(filesTable)
    .values({
      projectId: input.projectId,
      bucket: S3_BUCKET,
      objectKey,
      fileName,
      fileType: ext,
      mimeType: contentType,
      size,
      section: input.section,
      folderPath,
      uploadedBy: user.id,
    })
    .onConflictDoUpdate({
      target: filesTable.objectKey,
      set: { size, deletedAt: null, updatedAt: new Date() },
    })
    .returning();

  if (input.section === "annotated" && isLabel(fileName)) {
    await db.insert(labelUploads).values({
      projectId: input.projectId,
      labelFileId: row.id,
      uploadedBy: user.id,
      status: "uploaded",
    });
    await logActivity({
      userId: user.id, action: "label_uploaded", projectId: input.projectId,
      targetType: "file", targetId: row.id, details: { fileName, via: "api" },
    });
  } else {
    await logActivity({
      userId: user.id, action: "file_uploaded", projectId: input.projectId,
      targetType: "file", targetId: row.id, details: { fileName, section: input.section, via: "api" },
    });
  }

  return toFileItem(row);
}
