import { getApiUser } from "@/lib/api/auth";
import { json, unauthorized, forbidden, badRequest } from "@/lib/api/http";
import { listAccessibleProjects } from "@/lib/db/queries/projects";
import { canManageProjects } from "@/lib/permissions";
import { createProjectForUser } from "@/lib/projects/create";
import { createProjectSchema } from "@/lib/projects/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/projects -> projects the caller can access. */
export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const projects = await listAccessibleProjects(user);
  return json({ projects });
}

/** POST /api/v1/projects (admin) -> create a project. */
export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  if (!canManageProjects(user)) return forbidden("Only admins can create projects.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Expected a JSON body.");
  }
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid project data.");
  }

  try {
    const project = await createProjectForUser(user, parsed.data);
    return json({ project }, 201);
  } catch (e) {
    console.error("[api createProject]", e);
    return json({ error: { code: "server_error", message: "Failed to create project." } }, 500);
  }
}
