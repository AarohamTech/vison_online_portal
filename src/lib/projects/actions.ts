"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { canManageProjects } from "@/lib/permissions";
import { createProjectSchema } from "./schema";
import { createProjectForUser } from "./create";

export interface CreateProjectState {
  error: string | null;
  fieldErrors?: Record<string, string[]>;
}

export async function createProjectAction(
  _prev: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
  const user = await requireUser();
  if (!canManageProjects(user)) {
    return { error: "You do not have permission to create projects." };
  }

  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    customerName: formData.get("customerName"),
    productName: formData.get("productName"),
    description: formData.get("description") ?? "",
    status: formData.get("status") ?? "active",
  });

  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  let newId: string;
  try {
    const project = await createProjectForUser(user, parsed.data);
    newId = project.id;
  } catch (e) {
    console.error("[createProject] failed", e);
    return { error: "Failed to create project. Please try again." };
  }

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect(`/projects/${newId}`);
}
