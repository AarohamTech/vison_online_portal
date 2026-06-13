import "server-only";
import { db } from "@/lib/db";
import { activityLogs } from "@/lib/db/schema";
import type { ActivityAction } from "@/types";

export interface LogActivityInput {
  userId: string;
  action: ActivityAction;
  projectId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown> | null;
}

/** Best-effort activity log. Never throws into the caller's happy path. */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      userId: input.userId,
      action: input.action,
      projectId: input.projectId ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      details: input.details ?? null,
    });
  } catch (e) {
    console.error("[activity] failed to log", input.action, e);
  }
}
