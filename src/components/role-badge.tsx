import { ShieldCheck, Wrench, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

const CONFIG: Record<
  Role,
  { label: string; icon: typeof ShieldCheck; className: string }
> = {
  admin: {
    label: "Admin",
    icon: ShieldCheck,
    className:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  maintainer: {
    label: "Maintainer",
    icon: Wrench,
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
  annotator: {
    label: "Annotator",
    icon: Tag,
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
};

export function RoleBadge({
  role,
  className,
}: {
  role: Role;
  className?: string;
}) {
  const cfg = CONFIG[role];
  const Icon = cfg.icon;
  return (
    <Badge
      variant="secondary"
      className={cn("gap-1 border-0", cfg.className, className)}
    >
      <Icon className="size-3" />
      {cfg.label}
    </Badge>
  );
}
