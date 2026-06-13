import "server-only";
import { redirect } from "next/navigation";
import { auth } from "./index";
import type { Role } from "@/types";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    role: session.user.role,
  };
}

/** Use in protected server components/actions. Redirects if not signed in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
