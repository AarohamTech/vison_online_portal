import { Activity } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ACTIVITY_LABELS, formatRelativeTime } from "@/lib/format";
import type { ActivityWithUser } from "@/lib/db/queries/stats";

export function ActivityLogTable({
  items,
  showProject,
}: {
  items: ActivityWithUser[];
  showProject?: boolean;
}) {
  if (items.length === 0) {
    return <EmptyState icon={Activity} title="No activity yet" description="Actions across the workspace will show up here." />;
  }
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead className="text-right">When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.userName ?? a.userEmail ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{ACTIVITY_LABELS[a.action] ?? a.action}</TableCell>
              <TableCell className="max-w-xs truncate text-muted-foreground">
                {typeof a.details?.fileName === "string"
                  ? a.details.fileName
                  : typeof a.details?.name === "string"
                    ? a.details.name
                    : a.targetType ?? "—"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">{formatRelativeTime(a.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
