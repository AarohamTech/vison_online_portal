import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Building2,
  Package,
  Images,
  Tags,
  HardDrive,
} from "lucide-react";
import { loadAccessContext } from "@/lib/projects/access";
import { canAccessProject, canViewInstaller, canManageUsers } from "@/lib/permissions";
import { getProjectById, listAccessibleProjects } from "@/lib/db/queries/projects";
import { ProjectStatusBadge } from "@/components/project-status-badge";
import { ProjectTabs, type ProjectTab } from "@/components/project-tabs";
import { formatBytes, formatNumber } from "@/lib/format";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { user, membership } = await loadAccessContext(projectId);

  const project = await getProjectById(projectId);
  if (!project) notFound();
  if (!canAccessProject(user, membership)) redirect("/projects");

  const withAgg = (await listAccessibleProjects(user)).find((p) => p.id === projectId);
  const images = withAgg?.totalImages ?? 0;
  const labels = withAgg?.totalLabels ?? 0;
  const bytes = withAgg?.storageBytes ?? 0;

  const base = `/projects/${projectId}`;
  const tabs: ProjectTab[] = [
    { label: "Overview", href: base, exact: true },
    { label: "Train Data", href: `${base}/train-data` },
    { label: "Annotated", href: `${base}/annotated` },
  ];
  if (canViewInstaller(user)) tabs.push({ label: "Installer", href: `${base}/installer` });
  if (canManageUsers(user)) {
    tabs.push({ label: "Users", href: `${base}/users` });
    tabs.push({ label: "Activity", href: `${base}/activity` });
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Projects
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Building2 className="size-3.5" />{project.customerName}</span>
            <span className="flex items-center gap-1.5"><Package className="size-3.5" />{project.productName}</span>
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground"><Images className="size-4" />{formatNumber(images)}</span>
          <span className="flex items-center gap-1.5 text-muted-foreground"><Tags className="size-4" />{formatNumber(labels)}</span>
          <span className="flex items-center gap-1.5 text-muted-foreground"><HardDrive className="size-4" />{formatBytes(bytes)}</span>
        </div>
      </div>

      <ProjectTabs tabs={tabs} />

      <div>{children}</div>
    </div>
  );
}
