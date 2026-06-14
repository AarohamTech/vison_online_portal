import { getApiUser } from "@/lib/api/auth";
import { json, unauthorized } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/auth/me -> current user (validates the bearer token). */
export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  return json({ user });
}
