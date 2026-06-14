import { getApiContext } from "@/lib/api/auth";
import { json, unauthorized, forbidden, notFound } from "@/lib/api/http";
import { canAccessProject } from "@/lib/permissions";
import { getProjectById } from "@/lib/db/queries/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/projects/{id} -> project detail. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const ctx = await getApiContext(req, projectId);
  if (!ctx) return unauthorized();
  if (!canAccessProject(ctx.user, ctx.membership)) return forbidden();

  const project = await getProjectById(projectId);
  if (!project) return notFound("Project not found.");
  return json({ project });
}
