import Link from "next/link";
import { ClipboardList, Images, Tags, FolderOpen, Upload } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAssignments } from "@/lib/db/queries/assignments";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ProjectStatusBadge } from "@/components/project-status-badge";
import { formatNumber } from "@/lib/format";

export default async function AssignmentsPage() {
  const user = await requireUser();
  const assignments = await getMyAssignments(user.id);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Assignments</h1>
        <p className="text-sm text-muted-foreground">
          Projects and folders assigned to you.
        </p>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assignments yet"
          description="An admin hasn't assigned you to any projects yet."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((a) => (
            <Card key={a.project.id} className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{a.project.name}</h3>
                  <p className="truncate text-sm text-muted-foreground">{a.project.customerName}</p>
                </div>
                <ProjectStatusBadge status={a.project.status} />
              </CardHeader>
              <CardContent className="flex-1 space-y-2 text-sm">
                <div className="flex gap-4 text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Images className="size-4" />{formatNumber(a.imageCount)} images</span>
                  <span className="flex items-center gap-1.5"><Tags className="size-4" />{formatNumber(a.myLabelCount)} my labels</span>
                </div>
                {a.assignedPaths.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {a.assignedPaths.map((p) => (
                      <Badge key={p} variant="secondary" className="font-mono text-xs">{p}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="gap-2 border-t pt-3">
                <Button asChild size="sm" variant="outline" className="flex-1">
                  <Link href={`/projects/${a.project.id}/train-data`}>
                    <FolderOpen className="size-4" /> Open
                  </Link>
                </Button>
                <Button asChild size="sm" className="flex-1">
                  <Link href={`/projects/${a.project.id}/annotated`}>
                    <Upload className="size-4" /> Upload labels
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
