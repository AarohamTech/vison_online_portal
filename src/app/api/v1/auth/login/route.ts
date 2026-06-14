import bcrypt from "bcryptjs";
import { z } from "zod";
import { getProfileByEmail } from "@/lib/db/queries/profiles";
import { signApiToken } from "@/lib/api/token";
import { json, badRequest, unauthorized } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** POST /api/v1/auth/login  { email, password } -> { token, user } */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Expected a JSON body.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("email and password are required.");

  const { email, password } = parsed.data;
  const profile = await getProfileByEmail(email);
  if (!profile) {
    await bcrypt.compare(password, "$2a$10$invalidinvalidinvalidinvalidin");
    return unauthorized("Invalid email or password.");
  }

  const ok = await bcrypt.compare(password, profile.passwordHash);
  if (!ok) return unauthorized("Invalid email or password.");

  const token = await signApiToken({
    sub: profile.id,
    email: profile.email,
    role: profile.role,
  });

  return json({
    token,
    tokenType: "Bearer",
    expiresInDays: 30,
    user: {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
    },
  });
}
