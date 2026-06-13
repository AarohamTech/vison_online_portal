"use server";

import { getFileById } from "@/lib/db/queries/files";
import { loadAccessContext } from "@/lib/projects/access";
import { canViewSection, canDownloadFolder } from "@/lib/permissions";
import { signedDownloadUrl, getObjectBytes } from "@/lib/s3/client";
import { logActivity } from "@/lib/db/queries/activity";
import { isLabel } from "@/lib/validation/files";

/** Signed URL for inline viewing (image preview/thumbnail). View permission. */
export async function getViewUrl(fileId: string): Promise<string | null> {
  const file = await getFileById(fileId);
  if (!file) return null;
  const { user, membership } = await loadAccessContext(file.projectId);
  if (!canViewSection(user, membership, file.section)) return null;
  return signedDownloadUrl(file.objectKey, 900);
}

/** Signed URL forcing download. Requires download permission for the section. */
export async function getDownloadUrl(fileId: string): Promise<string | null> {
  const file = await getFileById(fileId);
  if (!file) return null;
  const { user, membership } = await loadAccessContext(file.projectId);
  if (!canDownloadFolder(user, membership, file.section)) return null;

  const url = await signedDownloadUrl(file.objectKey, 900, file.fileName);
  await logActivity({
    userId: user.id,
    action: "zip_downloaded", // single-file download reuses download action
    projectId: file.projectId,
    targetType: "file",
    targetId: file.id,
    details: { fileName: file.fileName, single: true },
  });
  return url;
}

const MAX_TEXT_PREVIEW = 256 * 1024; // 256 KB

/** Text content of a label file for preview. View permission required. */
export async function getLabelText(
  fileId: string
): Promise<{ text: string; truncated: boolean } | null> {
  const file = await getFileById(fileId);
  if (!file) return null;
  if (!isLabel(file.fileName)) return null;
  const { user, membership } = await loadAccessContext(file.projectId);
  if (!canViewSection(user, membership, file.section)) return null;

  const bytes = await getObjectBytes(file.objectKey);
  const slice = bytes.slice(0, MAX_TEXT_PREVIEW);
  const text = new TextDecoder().decode(slice);
  return { text, truncated: bytes.length > MAX_TEXT_PREVIEW };
}
