"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { profiles, projectMembers } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/permissions";
import { logActivity } from "@/lib/db/queries/activity";
import { ROLES } from "@/types";
import type { Role } from "@/types";

async function assertAdmin() {
  const user = await requireUser();
  if (!canManageUsers(user)) throw new Error("Forbidden");
  return user;
}

const roleSchema = z.enum(ROLES as [Role, ...Role[]]);

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().max(120).optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: roleSchema,
});

export interface ActionResult {
  ok: boolean;
  error: string | null;
}

export async function createUserAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await assertAdmin();
  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName") ?? "",
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { email, fullName, password, role } = parsed.data;

  const existing = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.email, email.toLowerCase()))
    .limit(1);
  if (existing.length) return { ok: false, error: "A user with that email already exists." };

  const passwordHash = await bcrypt.hash(password, 10);
  const [row] = await db
    .insert(profiles)
    .values({ email: email.toLowerCase(), passwordHash, fullName: fullName || null, role })
    .returning();

  await logActivity({
    userId: admin.id, action: "role_changed", targetType: "user", targetId: row.id,
    details: { created: true, email: row.email, role },
  });
  revalidatePath("/users");
  return { ok: true, error: null };
}

export async function updateUserRoleAction(userId: string, role: Role): Promise<void> {
  const admin = await assertAdmin();
  roleSchema.parse(role);
  if (userId === admin.id) throw new Error("You cannot change your own role.");

  await db.update(profiles).set({ role, updatedAt: new Date() }).where(eq(profiles.id, userId));
  await logActivity({
    userId: admin.id, action: "role_changed", targetType: "user", targetId: userId,
    details: { role },
  });
  revalidatePath("/users");
}

const assignSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  role: roleSchema,
  canDownload: z.boolean(),
  canUploadImages: z.boolean(),
  assignedPaths: z.array(z.string()).default([]),
});

export async function assignMemberAction(input: {
  projectId: string;
  userId: string;
  role: Role;
  canDownload: boolean;
  canUploadImages: boolean;
  assignedPaths?: string[];
}): Promise<void> {
  const admin = await assertAdmin();
  const v = assignSchema.parse({ ...input, assignedPaths: input.assignedPaths ?? [] });

  await db
    .insert(projectMembers)
    .values({
      projectId: v.projectId,
      userId: v.userId,
      role: v.role,
      canDownload: v.canDownload,
      canUploadImages: v.canUploadImages,
      assignedPaths: v.assignedPaths,
    })
    .onConflictDoUpdate({
      target: [projectMembers.projectId, projectMembers.userId],
      set: {
        role: v.role,
        canDownload: v.canDownload,
        canUploadImages: v.canUploadImages,
        assignedPaths: v.assignedPaths,
      },
    });

  await logActivity({
    userId: admin.id, action: "user_assigned", projectId: v.projectId,
    targetType: "user", targetId: v.userId, details: { role: v.role },
  });
  revalidatePath(`/projects/${v.projectId}/users`);
  revalidatePath("/users");
}

export async function removeMemberAction(projectId: string, userId: string): Promise<void> {
  const admin = await assertAdmin();
  await db
    .delete(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  await logActivity({
    userId: admin.id, action: "user_assigned", projectId,
    targetType: "user", targetId: userId, details: { removed: true },
  });
  revalidatePath(`/projects/${projectId}/users`);
}
