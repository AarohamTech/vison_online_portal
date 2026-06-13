import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { ZipArchive } from "archiver";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3, S3_BUCKET } from "@/lib/s3/client";
import {
  planZip,
  ZipForbiddenError,
  ZipEmptyError,
  type ZipScope,
} from "@/lib/zip/collect";
import { loadAccessContext } from "@/lib/projects/access";
import { logActivity } from "@/lib/db/queries/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const sp = req.nextUrl.searchParams;
  const scope = (sp.get("scope") ?? "section") as ZipScope;
  const sectionSlug = sp.get("section") ?? undefined;
  const path = sp.get("path") ?? undefined;
  const ids = sp.get("ids") ? sp.get("ids")!.split(",").filter(Boolean) : undefined;

  let plan;
  try {
    plan = await planZip({ projectId, scope, sectionSlug, path, ids });
  } catch (e) {
    if (e instanceof ZipForbiddenError)
      return new Response("Forbidden", { status: 403 });
    if (e instanceof ZipEmptyError)
      return new Response("Nothing to download", { status: 404 });
    console.error("[zip] plan failed", e);
    return new Response("Failed to prepare ZIP", { status: 500 });
  }

  const archive = new ZipArchive({ zlib: { level: 6 } });

  // Append objects in the background while the response streams.
  (async () => {
    try {
      for (const entry of plan.entries) {
        const res = await s3().send(
          new GetObjectCommand({ Bucket: S3_BUCKET, Key: entry.key })
        );
        archive.append(res.Body as Readable, { name: entry.zipPath });
      }
      await archive.finalize();
    } catch (err) {
      console.error("[zip] stream failed", err);
      archive.abort();
    }
  })();

  // Best-effort activity log (don't block the stream).
  loadAccessContext(projectId)
    .then(({ user }) =>
      logActivity({
        userId: user.id,
        action: "zip_downloaded",
        projectId,
        targetType: "zip",
        targetId: scope,
        details: { scope, count: plan.entries.length },
      })
    )
    .catch(() => {});

  const webStream = Readable.toWeb(archive) as unknown as ReadableStream;
  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${plan.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
