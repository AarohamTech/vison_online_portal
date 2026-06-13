"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { assignMemberAction, removeMemberAction } from "@/lib/users/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RoleBadge } from "@/components/role-badge";
import { EmptyState } from "@/components/empty-state";
import { Users } from "lucide-react";
import type { Role, User } from "@/types";
import type { MemberWithUser } from "@/lib/db/queries/members";

const MEMBER_ROLES: Role[] = ["maintainer", "annotator"];

export function ProjectMemberManager({
  projectId,
  members,
  candidates,
}: {
  projectId: string;
  members: MemberWithUser[];
  candidates: User[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<Role>("annotator");
  const [canDownload, setCanDownload] = useState(true);
  const [canUploadImages, setCanUploadImages] = useState(false);

  const available = useMemo(
    () => candidates.filter((c) => !members.some((m) => m.userId === c.id)),
    [candidates, members]
  );

  async function addMember() {
    if (!userId) return;
    setBusy(true);
    try {
      await assignMemberAction({ projectId, userId, role, canDownload, canUploadImages });
      toast.success("Member assigned.");
      setOpen(false);
      setUserId("");
      router.refresh();
    } catch {
      toast.error("Failed to assign member.");
    } finally {
      setBusy(false);
    }
  }

  async function update(m: MemberWithUser, patch: Partial<Pick<MemberWithUser, "canDownload" | "canUploadImages" | "role">>) {
    try {
      await assignMemberAction({
        projectId,
        userId: m.userId,
        role: patch.role ?? m.role,
        canDownload: patch.canDownload ?? m.canDownload,
        canUploadImages: patch.canUploadImages ?? m.canUploadImages,
        assignedPaths: m.assignedPaths,
      });
      router.refresh();
    } catch {
      toast.error("Update failed.");
    }
  }

  async function remove(m: MemberWithUser) {
    try {
      await removeMemberAction(projectId, m.userId);
      toast.success("Member removed.");
      router.refresh();
    } catch {
      toast.error("Failed to remove member.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={available.length === 0}>
              <UserPlus className="size-4" /> Assign member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign member</DialogTitle>
              <DialogDescription>Grant a user access to this project.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>User</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
                  <SelectContent>
                    {available.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName ?? u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Project role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEMBER_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={canDownload} onCheckedChange={(c) => setCanDownload(!!c)} />
                Can download
              </label>
              {role === "annotator" && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={canUploadImages} onCheckedChange={(c) => setCanUploadImages(!!c)} />
                  Allow uploading images (in addition to labels)
                </label>
              )}
            </div>
            <DialogFooter>
              <Button onClick={addMember} disabled={!userId || busy}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {members.length === 0 ? (
        <EmptyState icon={Users} title="No members assigned" description="Assign maintainers or annotators to give them access." />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Download</TableHead>
                <TableHead>Upload images</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <p className="font-medium">{m.fullName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </TableCell>
                  <TableCell><RoleBadge role={m.role} /></TableCell>
                  <TableCell>
                    <Checkbox checked={m.canDownload} onCheckedChange={(c) => update(m, { canDownload: !!c })} />
                  </TableCell>
                  <TableCell>
                    {m.role === "annotator" ? (
                      <Checkbox checked={m.canUploadImages} onCheckedChange={(c) => update(m, { canUploadImages: !!c })} />
                    ) : (
                      <span className="text-xs text-muted-foreground">n/a</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => remove(m)} aria-label="Remove">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
