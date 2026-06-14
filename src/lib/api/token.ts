import "server-only";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/types";

/**
 * API tokens are HS256 JWTs signed with AUTH_SECRET. They are intended for
 * machine clients (e.g. the desktop uploader) that authenticate with email +
 * password once and then send `Authorization: Bearer <token>`.
 */

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set.");
  return new TextEncoder().encode(s);
}

export interface ApiTokenClaims {
  sub: string; // user id
  email: string;
  role: Role;
}

const ISSUER = "vision-dataset-manager";
const AUDIENCE = "vdm-api";

export async function signApiToken(
  claims: ApiTokenClaims,
  expiresIn = "30d"
): Promise<string> {
  return new SignJWT({ email: claims.email, role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret());
}

export async function verifyApiToken(
  token: string
): Promise<ApiTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (!payload.sub || !payload.email || !payload.role) return null;
    return {
      sub: payload.sub,
      email: payload.email as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}
