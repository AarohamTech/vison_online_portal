import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { canManageProjects } from "@/lib/permissions";
import { listAccessibleProjects } from "@/lib/db/queries/projects";
import { ProjectsExplorer } from "@/components/projects-explorer";
import { Button } from "@/components/ui/button";

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await listAccessibleProjects(user);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            {user.role === "admin"
              ? "All projects across the platform."
              : "Projects you've been assigned to."}
          </p>
        </div>
        {canManageProjects(user) && (
          <Button asChild size="sm">
            <Link href="/projects/new">
              <Plus className="size-4" /> Create Project
            </Link>
          </Button>
        )}
      </div>

      <ProjectsExplorer projects={projects} />
    </div>
  );
}
