"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  FolderUp,
  File as FileIcon,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import {
  prepareUploads,
  confirmUploads,
  type ConflictStrategy,
  type PreparedUpload,
  type ConfirmItem,
} from "@/lib/files/upload-actions";
import type { Section } from "@/types";

interface Picked {
  clientId: string;
  file: File;
  relPath: string;
}

type Status = "pending" | "uploading" | "done" | "failed" | "skipped" | "blocked";

function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`S3 PUT failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export function UploadModal({
  projectId,
  section,
  bucket,
  currentPath,
  open,
  onOpenChange,
}: {
  projectId: string;
  section: Exclude<Section, "metadata">;
  bucket: string;
  currentPath: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const [picked, setPicked] = useState<Picked[]>([]);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [conflict, setConflict] = useState<null | {
    dupIds: string[];
    nonDup: PreparedUpload[];
    blocked: { clientId: string; reason: string }[];
  }>(null);

  const reset = useCallback(() => {
    setPicked([]); setStatus({}); setProgress({}); setBusy(false); setConflict(null);
  }, []);

  const addFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    const next: Picked[] = [];
    Array.from(list).forEach((file, i) => {
      const rel =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name;
      next.push({ clientId: `${Date.now()}-${i}-${file.name}`, file, relPath: rel });
    });
    setPicked((prev) => [...prev, ...next]);
  }, []);

  const totalSize = picked.reduce((s, p) => s + p.file.size, 0);

  async function runUploads(uploads: PreparedUpload[]) {
    const byId = new Map(picked.map((p) => [p.clientId, p]));
    const succeeded: ConfirmItem[] = [];

    // small concurrency pool
    const queue = [...uploads];
    const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length) {
        const u = queue.shift()!;
        const p = byId.get(u.clientId);
        if (!p) continue;
        setStatus((s) => ({ ...s, [u.clientId]: "uploading" }));
        try {
          await putWithProgress(u.url, p.file, u.contentType, (pct) =>
            setProgress((pr) => ({ ...pr, [u.clientId]: pct }))
          );
          setStatus((s) => ({ ...s, [u.clientId]: "done" }));
          succeeded.push({
            objectKey: u.objectKey, fileName: u.fileName, folderPath: u.folderPath,
            fileType: u.fileType, contentType: u.contentType, size: u.size,
          });
        } catch {
          setStatus((s) => ({ ...s, [u.clientId]: "failed" }));
        }
      }
    });
    await Promise.all(workers);

    if (succeeded.length) {
      const { inserted } = await confirmUploads(projectId, section, bucket, succeeded);
      toast.success(`Uploaded ${inserted} file${inserted === 1 ? "" : "s"}.`);
      router.refresh();
    }
    if (succeeded.length < uploads.length) {
      toast.error(`${uploads.length - succeeded.length} file(s) failed to upload.`);
    }
    setBusy(false);
  }

  async function start() {
    if (!picked.length) return;
    setBusy(true);
    const items = picked.map((p) => ({
      clientId: p.clientId, relPath: p.relPath, size: p.file.size, type: p.file.type,
    }));
    const res = await prepareUploads(projectId, section, currentPath, items, "detect");

    const blockedMarks: Record<string, Status> = {};
    res.blocked.forEach((b) => (blockedMarks[b.clientId] = "blocked"));
    if (res.blocked.length) {
      setStatus((s) => ({ ...s, ...blockedMarks }));
      toast.warning(`${res.blocked.length} file(s) blocked by upload rules.`);
    }

    if (res.duplicates.length) {
      setConflict({
        dupIds: res.duplicates.map((d) => d.clientId),
        nonDup: res.uploads,
        blocked: res.blocked,
      });
      setBusy(false);
      return;
    }
    await runUploads(res.uploads);
  }

  async function resolveConflict(strategy: Exclude<ConflictStrategy, "detect">) {
    if (!conflict) return;
    setBusy(true);
    const dupItems = picked
      .filter((p) => conflict.dupIds.includes(p.clientId))
      .map((p) => ({ clientId: p.clientId, relPath: p.relPath, size: p.file.size, type: p.file.type }));

    let extra: PreparedUpload[] = [];
    if (strategy !== "skip") {
      const r = await prepareUploads(projectId, section, currentPath, dupItems, strategy);
      extra = r.uploads;
    } else {
      const skip: Record<string, Status> = {};
      conflict.dupIds.forEach((id) => (skip[id] = "skipped"));
      setStatus((s) => ({ ...s, ...skip }));
    }
    const all = [...conflict.nonDup, ...extra];
    setConflict(null);
    await runUploads(all);
  }

  function removeItem(id: string) {
    setPicked((prev) => prev.filter((p) => p.clientId !== id));
  }

  const destLabel = currentPath ? `/${currentPath}` : "(root)";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload to {destLabel}</DialogTitle>
          <DialogDescription>
            Folder structure is preserved. Files are validated against your role.
          </DialogDescription>
        </DialogHeader>

        {/* Hidden inputs */}
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        <input
          ref={folderInput}
          type="file"
          hidden
          // @ts-expect-error non-standard but widely supported
          webkitdirectory=""
          multiple
          onChange={(e) => addFiles(e.target.files)}
        />

        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border"
          )}
        >
          <UploadCloud className="size-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Drag &amp; drop files here, or</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} disabled={busy}>
              <FileIcon className="size-4" /> Files
            </Button>
            <Button size="sm" variant="outline" onClick={() => folderInput.current?.click()} disabled={busy}>
              <FolderUp className="size-4" /> Folder
            </Button>
          </div>
        </div>

        {picked.length > 0 && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {picked.length} file{picked.length === 1 ? "" : "s"} · {formatBytes(totalSize)}
              </span>
              {!busy && (
                <Button size="sm" variant="ghost" onClick={reset}>Clear</Button>
              )}
            </div>
            <ScrollArea className="max-h-56 rounded-md border">
              <ul className="divide-y">
                {picked.map((p) => {
                  const st = status[p.clientId] ?? "pending";
                  return (
                    <li key={p.clientId} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <StatusIcon status={st} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{p.relPath}</p>
                        {st === "uploading" && (
                          <Progress value={progress[p.clientId] ?? 0} className="mt-1 h-1" />
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatBytes(p.file.size)}
                      </span>
                      {!busy && st === "pending" && (
                        <button onClick={() => removeItem(p.clientId)} aria-label="Remove">
                          <X className="size-3.5 text-muted-foreground hover:text-foreground" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </>
        )}

        {conflict && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="font-medium">{conflict.dupIds.length} file(s) already exist.</p>
            <p className="mt-0.5 text-muted-foreground">How should duplicates be handled?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => resolveConflict("skip")} disabled={busy}>Skip</Button>
              <Button size="sm" variant="outline" onClick={() => resolveConflict("replace")} disabled={busy}>Replace</Button>
              <Button size="sm" onClick={() => resolveConflict("rename")} disabled={busy}>Keep both</Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => { if (!busy) { reset(); onOpenChange(false); } }} disabled={busy}>
            Close
          </Button>
          <Button onClick={start} disabled={busy || picked.length === 0 || !!conflict}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "done") return <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />;
  if (status === "uploading") return <Loader2 className="size-4 shrink-0 animate-spin text-primary" />;
  if (status === "failed" || status === "blocked")
    return <AlertCircle className="size-4 shrink-0 text-destructive" />;
  if (status === "skipped") return <X className="size-4 shrink-0 text-muted-foreground" />;
  return <FileIcon className="size-4 shrink-0 text-muted-foreground" />;
}
