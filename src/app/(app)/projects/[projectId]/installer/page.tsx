import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { canViewInstaller } from "@/lib/permissions";
import { SectionBrowser } from "@/components/section-browser";

export default async function InstallerPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ path?: string }>;
}) {
  const { projectId } = await params;
  const { path } = await searchParams;
  const user = await requireUser();
  if (!canViewInstaller(user)) redirect(`/projects/${projectId}`);
  return (
    <SectionBrowser projectId={projectId} section="installer" rawPath={path ?? ""} />
  );
}
