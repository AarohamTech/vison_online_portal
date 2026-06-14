import { getApiContext } from "@/lib/api/auth";
import { json, unauthorized, forbidden, badRequest } from "@/lib/api/http";
import { canViewSection } from "@/lib/permissions";
import { listDirectory } from "@/lib/db/queries/files";
import { storeUploadedFile, UploadRejectedError } from "@/lib/files/upload-core";
import { normalizeRelativePath } from "@/lib/s3/keys";
import type { Section } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BROWSABLE: Section[] = ["train_data", "annotated", "installer"];

function parseSection(value: string | null): Exclude<Section, "metadata"> | null {
  if (!value) return null;
  const v = value.replace(/-/g, "_");
  return (BROWSABLE as string[]).includes(v) ? (v as Exclude<Section, "metadata">) : null;
}

/** GET /api/v1/projects/{id}/files?section=train_data&path=foo/bar */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const ctx = await getApiContext(req, projectId);
  if (!ctx) return unauthorized();

  const url = new URL(req.url);
  const section = parseSection(url.searchParams.get("section")) ?? "train_data";
  if (!canViewSection(ctx.user, ctx.membership, section)) return forbidden();

  let path = "";
  try {
    path = normalizeRelativePath(url.searchParams.get("path") ?? "");
  } catch {
    return badRequest("Invalid path.");
  }

  const listing = await listDirectory(projectId, section, path);
  return json({
    section,
    path,
    folders: listing.folders,
    files: listing.files.map((f) => ({
      id: f.id, fileName: f.fileName, fileType: f.fileType, size: f.size,
      folderPath: f.folderPath, createdAt: f.createdAt,
    })),
  });
}

/**
 * POST /api/v1/projects/{id}/files  (multipart/form-data)
 * fields: file (required), section (default train_data), path (optional)
 * Uploads bytes directly through the API to S3 and records the file.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const ctx = await getApiContext(req, projectId);
  if (!ctx) return unauthorized();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("Expected multipart/form-data with a 'file' field.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("Missing 'file'.");

  const section = parseSection(form.get("section") as string | null) ?? "train_data";
  const destPath = (form.get("path") as string | null) ?? "";
  // relative path preserves folder structure if the client sends one
  const relPath = (form.get("relPath") as string | null) || file.name;

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const stored = await storeUploadedFile(ctx.user, ctx.membership, {
      projectId,
      section,
      destPath,
      relPath,
      bytes,
      contentType: file.type || undefined,
      client: req.headers.get("x-client") ?? undefined,
    });
    return json({
      file: {
        id: stored.id, fileName: stored.fileName, fileType: stored.fileType,
        size: stored.size, section: stored.section, folderPath: stored.folderPath,
        objectKey: stored.objectKey, createdAt: stored.createdAt,
      },
    }, 201);
  } catch (e) {
    if (e instanceof UploadRejectedError) return forbidden(e.message);
    console.error("[api upload]", e);
    return json({ error: { code: "server_error", message: "Upload failed." } }, 500);
  }
}
