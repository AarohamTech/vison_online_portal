import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types";

const CONFIG: Record<ProjectStatus, { label: string; className: string }> = {
  active: {
    label: "Active",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  on_hold: {
    label: "On hold",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  archived: {
    label: "Archived",
    className:
      "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300",
  },
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const cfg = CONFIG[status];
  return (
    <Badge variant="secondary" className={cn("border-0", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}
