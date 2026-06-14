import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { files as filesTable } from "@/lib/db/schema";
import { getApiContext } from "@/lib/api/auth";
import { json, unauthorized, forbidden, notFound } from "@/lib/api/http";
import { canDeleteImages, canManageInstaller } from "@/lib/permissions";
import { getFileById } from "@/lib/db/queries/files";
import { deleteObject } from "@/lib/s3/client";
import { logActivity } from "@/lib/db/queries/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/v1/projects/{id}/files/{fileId} -> soft-delete + remove from S3. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  const { projectId, fileId } = await params;
  const ctx = await getApiContext(req, projectId);
  if (!ctx) return unauthorized();

  const file = await getFileById(fileId);
  if (!file || file.projectId !== projectId || file.deletedAt) {
    return notFound("File not found.");
  }

  const allowed =
    file.section === "installer"
      ? canManageInstaller(ctx.user)
      : canDeleteImages(ctx.user, ctx.membership);
  if (!allowed) return forbidden("You cannot delete this file.");

  await db
    .update(filesTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(filesTable.id, fileId));

  // Best-effort removal from storage.
  await deleteObject(file.objectKey).catch((e) =>
    console.error("[api delete] S3 remove failed", e)
  );

  await logActivity({
    userId: ctx.user.id, action: "file_deleted", projectId,
    targetType: "file", targetId: fileId,
    details: { fileName: file.fileName, via: req.headers.get("x-client") ?? "api" },
  });

  return json({ ok: true, deleted: fileId });
}
