import Link from "next/link";
import { Images, Tags, Building2, Package } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ProjectStatusBadge } from "@/components/project-status-badge";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import type { Project } from "@/types";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="group block">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div className="min-w-0">
            <h3 className="truncate font-semibold leading-tight group-hover:text-primary">
              {project.name}
            </h3>
          </div>
          <ProjectStatusBadge status={project.status} />
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Building2 className="size-3.5" />
            <span className="truncate">{project.customerName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Package className="size-3.5" />
            <span className="truncate">{project.productName}</span>
          </div>
        </CardContent>
        <CardFooter className="justify-between border-t pt-3 text-xs text-muted-foreground">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <Images className="size-3.5" />
              {formatNumber(project.totalImages ?? 0)}
            </span>
            <span className="flex items-center gap-1">
              <Tags className="size-3.5" />
              {formatNumber(project.totalLabels ?? 0)}
            </span>
          </div>
          <span>{formatRelativeTime(project.updatedAt)}</span>
        </CardFooter>
      </Card>
    </Link>
  );
}
