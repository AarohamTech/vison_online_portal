import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, projectMembers } from "@/lib/db/schema";
import { toUser } from "./profiles";
import type { User } from "@/types";

export async function listUsers(): Promise<User[]> {
  const rows = await db.select().from(profiles).orderBy(asc(profiles.email));
  return rows.map(toUser);
}

/** Users with a count of projects they belong to (for the admin users page). */
export interface UserWithProjectCount extends User {
  projectCount: number;
}

export async function listUsersWithProjectCounts(): Promise<UserWithProjectCount[]> {
  const rows = await db
    .select({
      profile: profiles,
      projectCount: sql<number>`count(${projectMembers.id})`,
    })
    .from(profiles)
    .leftJoin(projectMembers, eq(projectMembers.userId, profiles.id))
    .groupBy(profiles.id)
    .orderBy(asc(profiles.email));

  return rows.map((r) => ({
    ...toUser(r.profile),
    projectCount: Number(r.projectCount),
  }));
}
