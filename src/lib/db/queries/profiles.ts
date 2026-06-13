/**
 * Data-access for the profiles table (users + auth).
 * Server-only.
 */

import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import type { Role, User } from "@/types";

type ProfileRow = typeof profiles.$inferSelect;

/** Map a DB row to the app's User type (never exposes password_hash). */
export function toUser(row: ProfileRow): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Full row including password_hash — for auth verification only. */
export async function getProfileByEmail(
  email: string
): Promise<ProfileRow | undefined> {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, email.toLowerCase()))
    .limit(1);
  return rows[0];
}

export async function getProfileById(
  id: string
): Promise<ProfileRow | undefined> {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1);
  return rows[0];
}

export interface CreateProfileInput {
  email: string;
  passwordHash: string;
  fullName?: string | null;
  role?: Role;
}

export async function createProfile(
  input: CreateProfileInput
): Promise<ProfileRow> {
  const [row] = await db
    .insert(profiles)
    .values({
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      fullName: input.fullName ?? null,
      role: input.role ?? "annotator",
    })
    .returning();
  return row;
}
