import Link from "next/link";
import {
  FolderKanban,
  Images,
  Tags,
  Clock,
  HardDrive,
  Plus,
  Users,
  Upload,
  ClipboardList,
  Activity,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDashboardStats, recentActivity } from "@/lib/db/queries/stats";
import { recentProjects } from "@/lib/db/queries/projects";
import { formatBytes, formatNumber, formatRelativeTime, ACTIVITY_LABELS } from "@/lib/format";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Role } from "@/types";

function QuickActions({ role }: { role: Role }) {
  return (
    <div className="flex flex-wrap gap-2">
      {role === "admin" && (
        <>
          <Button asChild size="sm">
            <Link href="/projects/new">
              <Plus className="size-4" /> Create Project
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/users">
              <Users className="size-4" /> Manage Users
            </Link>
          </Button>
        </>
      )}
      {role === "maintainer" && (
        <Button asChild size="sm">
          <Link href="/uploads">
            <Upload className="size-4" /> Upload Data
          </Link>
        </Button>
      )}
      {role === "annotator" && (
        <Button asChild size="sm">
          <Link href="/assignments">
            <ClipboardList className="size-4" /> My Assigned Data
          </Link>
        </Button>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [stats, projects, activity] = await Promise.all([
    getDashboardStats(user),
    recentProjects(user, 5),
    recentActivity(user, 8),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {user.name ?? user.email}.
          </p>
        </div>
        <QuickActions role={user.role} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Projects" value={formatNumber(stats.totalProjects)} icon={FolderKanban} />
        <StatCard label="Images" value={formatNumber(stats.totalImages)} icon={Images} />
        <StatCard label="Labels" value={formatNumber(stats.totalLabels)} icon={Tags} />
        <StatCard
          label="Pending Labels"
          value={formatNumber(stats.pendingLabels)}
          icon={Clock}
          accent="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        />
        <StatCard label="Storage Used" value={formatBytes(stats.storageBytes)} icon={HardDrive} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Projects</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/projects">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No projects yet"
                description={
                  user.role === "admin"
                    ? "Create your first project to get started."
                    : "You haven't been assigned to any projects yet."
                }
                action={
                  user.role === "admin" ? (
                    <Button asChild size="sm">
                      <Link href="/projects/new">
                        <Plus className="size-4" /> Create Project
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Images</TableHead>
                    <TableHead className="text-right">Labels</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{p.productName}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.customerName}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(p.totalImages ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(p.totalLabels ?? 0)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatRelativeTime(p.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <EmptyState icon={Activity} title="No activity yet" className="py-8" />
            ) : (
              <ul className="space-y-4">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-3 text-sm">
                    <div className="mt-1 size-2 shrink-0 rounded-full bg-primary/60" />
                    <div className="min-w-0">
                      <p className="truncate">
                        <span className="font-medium">{a.userName ?? a.userEmail ?? "Someone"}</span>{" "}
                        <span className="text-muted-foreground">{ACTIVITY_LABELS[a.action] ?? a.action}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{formatRelativeTime(a.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
