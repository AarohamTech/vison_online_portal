"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fileIconFor } from "@/components/file-icon";
import { getViewUrl, getLabelText, getDownloadUrl } from "@/lib/files/actions";
import { isImage, isLabel } from "@/lib/validation/files";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import type { FileItem } from "@/types";

export function FilePreviewModal({
  files,
  index,
  onIndexChange,
  onClose,
  canDownload,
}: {
  files: FileItem[];
  index: number | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  canDownload: boolean;
}) {
  const open = index !== null;
  const file = index !== null ? files[index] : null;

  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [labelText, setLabelText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setViewUrl(null);
    setLabelText(null);
    setLoading(true);
    (async () => {
      try {
        if (isImage(file.fileName)) {
          const url = await getViewUrl(file.id);
          if (!cancelled) setViewUrl(url);
        } else if (isLabel(file.fileName)) {
          const res = await getLabelText(file.id);
          if (!cancelled) setLabelText(res ? res.text : "(could not load preview)");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const go = useCallback(
    (delta: number) => {
      if (index === null) return;
      const next = (index + delta + files.length) % files.length;
      onIndexChange(next);
    },
    [index, files.length, onIndexChange]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  async function handleDownload() {
    if (!file) return;
    setDownloading(true);
    try {
      const url = await getDownloadUrl(file.id);
      if (!url) {
        toast.error("You don't have permission to download this file.");
        return;
      }
      window.location.href = url;
    } catch {
      toast.error("Failed to start download.");
    } finally {
      setDownloading(false);
    }
  }

  if (!file) return null;
  const Icon = fileIconFor(file.fileName);
  const showImage = isImage(file.fileName);
  const showText = isLabel(file.fileName);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 truncate pr-8">
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{file.fileName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="relative flex min-h-[16rem] items-center justify-center rounded-md bg-muted/40">
          {loading && <Loader2 className="size-6 animate-spin text-muted-foreground" />}
          {!loading && showImage && viewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={viewUrl}
              alt={file.fileName}
              className="max-h-[60vh] w-auto rounded-md object-contain"
            />
          )}
          {!loading && showText && labelText !== null && (
            <ScrollArea className="h-[40vh] w-full">
              <pre className="whitespace-pre-wrap p-4 text-xs">{labelText}</pre>
            </ScrollArea>
          )}
          {!loading && !showImage && !showText && (
            <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
              <FileText className="size-8" />
              <span className="text-sm">No preview available.</span>
            </div>
          )}

          {files.length > 1 && (
            <>
              <Button
                variant="secondary" size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2"
                onClick={() => go(-1)} aria-label="Previous"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="secondary" size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => go(1)} aria-label="Next"
              >
                <ChevronRight className="size-4" />
              </Button>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          <Meta label="Size" value={formatBytes(file.size)} />
          <Meta label="Type" value={file.fileType.toUpperCase()} />
          <Meta label="Path" value={file.folderPath || "/"} mono />
          <Meta label="Uploaded" value={formatRelativeTime(file.createdAt)} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {files.length > 1 ? `${(index ?? 0) + 1} of ${files.length}` : ""}
          </span>
          {canDownload && (
            <Button onClick={handleDownload} disabled={downloading} size="sm">
              {downloading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
              Download
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2 border-b py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "truncate font-mono text-xs" : "truncate"}>{value}</span>
    </div>
  );
}
