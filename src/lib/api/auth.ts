import "server-only";
import { verifyApiToken } from "./token";
import { getProfileById } from "@/lib/db/queries/profiles";
import { getMembership } from "@/lib/db/queries/members";
import type { SessionUser } from "@/lib/auth/session";
import type { ProjectMember } from "@/types";

/** Extract + verify the bearer token, returning the live user or null. */
export async function getApiUser(req: Request): Promise<SessionUser | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const claims = await verifyApiToken(match[1]);
  if (!claims) return null;

  // Re-load from DB so role/account changes take effect immediately.
  const profile = await getProfileById(claims.sub);
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    name: profile.fullName,
    role: profile.role,
  };
}

export interface ApiContext {
  user: SessionUser;
  membership: ProjectMember | null;
}

/** Load API user + their membership in a project. */
export async function getApiContext(
  req: Request,
  projectId: string
): Promise<ApiContext | null> {
  const user = await getApiUser(req);
  if (!user) return null;
  const membership = await getMembership(projectId, user.id);
  return { user, membership };
}
