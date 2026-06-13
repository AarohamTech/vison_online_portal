import { getProjectById } from "@/lib/db/queries/projects";
import { assertProjectAccess } from "@/lib/projects/access";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await assertProjectAccess(projectId);
  const project = await getProjectById(projectId);
  if (!project) return null;

  return (
    <Card>
      <CardContent className="space-y-3 p-6 text-sm">
        <div className="flex justify-between gap-6 border-b pb-3">
          <span className="text-muted-foreground">Description</span>
          <span className="max-w-md text-right">{project.description || "—"}</span>
        </div>
        <div className="flex justify-between border-b pb-3">
          <span className="text-muted-foreground">Created</span>
          <span>{formatDate(project.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Project ID</span>
          <span className="font-mono text-xs">{project.id}</span>
        </div>
      </CardContent>
    </Card>
  );
}
