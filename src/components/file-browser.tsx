"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  FolderUp,
  FolderPlus,
  Download,
  Trash2,
  RefreshCw,
  Search,
  LayoutGrid,
  List,
  Folder,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { fileIconFor } from "@/components/file-icon";
import { FilePreviewModal } from "@/components/file-preview-modal";
import { UploadModal } from "@/components/upload-modal";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { isImage } from "@/lib/validation/files";
import { SECTION_SLUG } from "@/lib/sections";
import { cn } from "@/lib/utils";
import type { DirEntryFolder } from "@/lib/db/queries/files";
import type { FileItem, Section } from "@/types";

export interface BrowserPermissions {
  canUpload: boolean;
  canCreateFolder: boolean;
  canDelete: boolean;
  canDownload: boolean;
}

type SortKey = "name" | "size" | "date";

export function FileBrowser({
  projectId,
  section,
  bucket,
  basePath,
  currentPath,
  folders,
  files,
  thumbnailUrls,
  permissions,
}: {
  projectId: string;
  section: Section;
  bucket: string;
  basePath: string;
  currentPath: string;
  folders: DirEntryFolder[];
  files: FileItem[];
  thumbnailUrls: Record<string, string>;
  permissions: BrowserPermissions;
}) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const shownFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? files.filter((f) => f.fileName.toLowerCase().includes(q))
      : files;
    const sorted = [...list].sort((a, b) => {
      if (sortKey === "size") return b.size - a.size;
      if (sortKey === "date") return b.createdAt.localeCompare(a.createdAt);
      return a.fileName.localeCompare(b.fileName);
    });
    return sorted;
  }, [files, query, sortKey]);

  const shownFolders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? folders.filter((f) => f.name.toLowerCase().includes(q)) : folders;
  }, [folders, query]);

  const previewable = shownFiles; // modal navigates across all shown files

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const allSelected = shownFiles.length > 0 && selected.size === shownFiles.length;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(shownFiles.map((f) => f.id)));
  }

  const soon = (what: string) => () =>
    toast.info(`${what} will be enabled in the next phase.`);

  function startZip(scope: "folder" | "section" | "selection") {
    const params = new URLSearchParams({ scope });
    if (section !== "metadata") params.set("section", SECTION_SLUG[section]);
    if (scope === "folder" && currentPath) params.set("path", currentPath);
    if (scope === "selection") params.set("ids", [...selected].join(","));
    const url = `/api/projects/${projectId}/zip?${params.toString()}`;
    toast.info("Preparing ZIP…");
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => toast.success("Download started."), 900);
  }

  const isEmpty = shownFolders.length === 0 && shownFiles.length === 0;

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        {permissions.canUpload && (
          <>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="size-4" /> Upload Files
            </Button>
            <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
              <FolderUp className="size-4" /> Upload Folder
            </Button>
          </>
        )}
        {permissions.canCreateFolder && (
          <Button size="sm" variant="outline" onClick={soon("Creating folders")}>
            <FolderPlus className="size-4" /> Create Folder
          </Button>
        )}
        {permissions.canDownload && selected.size > 0 && (
          <Button size="sm" variant="outline" onClick={() => startZip("selection")}>
            <Download className="size-4" /> Download ({selected.size})
          </Button>
        )}
        {permissions.canDownload && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => startZip(currentPath ? "folder" : "section")}
          >
            <Download className="size-4" /> Download ZIP
          </Button>
        )}
        {permissions.canDelete && selected.size > 0 && (
          <Button size="sm" variant="destructive" onClick={soon("Bulk delete")}>
            <Trash2 className="size-4" /> Delete ({selected.size})
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => router.refresh()} aria-label="Refresh">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in this folder…"
            className="pl-8"
          />
        </div>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-36">
            <ArrowUpDown className="size-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="size">Size</SelectItem>
            <SelectItem value="date">Newest</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex rounded-md border">
          <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" className="rounded-r-none" onClick={() => setView("grid")} aria-label="Grid">
            <LayoutGrid className="size-4" />
          </Button>
          <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" className="rounded-l-none" onClick={() => setView("list")} aria-label="List">
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={Folder}
          title="This folder is empty"
          description={
            permissions.canUpload
              ? "Upload files or create a folder to get started."
              : "Nothing here yet."
          }
        />
      ) : view === "grid" ? (
        <GridView
          basePath={basePath}
          currentPath={currentPath}
          folders={shownFolders}
          files={shownFiles}
          thumbnailUrls={thumbnailUrls}
          selected={selected}
          onToggle={toggle}
          onPreview={(f) => setPreviewIndex(previewable.findIndex((x) => x.id === f.id))}
        />
      ) : (
        <ListView
          basePath={basePath}
          folders={shownFolders}
          files={shownFiles}
          selected={selected}
          allSelected={allSelected}
          onToggleAll={toggleAll}
          onToggle={toggle}
          onPreview={(f) => setPreviewIndex(previewable.findIndex((x) => x.id === f.id))}
        />
      )}

      <FilePreviewModal
        files={previewable}
        index={previewIndex}
        onIndexChange={setPreviewIndex}
        onClose={() => setPreviewIndex(null)}
        canDownload={permissions.canDownload}
      />

      {permissions.canUpload && section !== "metadata" && (
        <UploadModal
          projectId={projectId}
          section={section}
          bucket={bucket}
          currentPath={currentPath}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
        />
      )}
    </div>
  );
}

function folderHref(basePath: string, path: string) {
  return `${basePath}?path=${encodeURIComponent(path)}`;
}

function GridView({
  basePath,
  folders,
  files,
  thumbnailUrls,
  selected,
  onToggle,
  onPreview,
}: {
  basePath: string;
  currentPath: string;
  folders: DirEntryFolder[];
  files: FileItem[];
  thumbnailUrls: Record<string, string>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onPreview: (f: FileItem) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {folders.map((f) => (
        <Link
          key={f.path}
          href={folderHref(basePath, f.path)}
          className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center transition-colors hover:bg-muted"
        >
          <Folder className="size-9 text-muted-foreground" />
          <span className="w-full truncate text-sm font-medium">{f.name}</span>
        </Link>
      ))}
      {files.map((file) => {
        const Icon = fileIconFor(file.fileName);
        const thumb = isImage(file.fileName) ? thumbnailUrls[file.id] : undefined;
        const isSel = selected.has(file.id);
        return (
          <div
            key={file.id}
            className={cn(
              "group relative flex flex-col rounded-lg border bg-card transition-colors hover:bg-muted/50",
              isSel && "ring-2 ring-primary"
            )}
          >
            <div className="absolute left-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 data-[on=true]:opacity-100" data-on={isSel}>
              <Checkbox checked={isSel} onCheckedChange={() => onToggle(file.id)} />
            </div>
            <button
              type="button"
              onClick={() => onPreview(file)}
              className="flex aspect-square items-center justify-center overflow-hidden rounded-t-lg bg-muted/40"
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt={file.fileName} loading="lazy" className="size-full object-cover" />
              ) : (
                <Icon className="size-10 text-muted-foreground" />
              )}
            </button>
            <div className="space-y-0.5 p-2">
              <p className="truncate text-sm font-medium">{file.fileName}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({
  basePath,
  folders,
  files,
  selected,
  allSelected,
  onToggleAll,
  onToggle,
  onPreview,
}: {
  basePath: string;
  folders: DirEntryFolder[];
  files: FileItem[];
  selected: Set<string>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggle: (id: string) => void;
  onPreview: (f: FileItem) => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox checked={allSelected} onCheckedChange={onToggleAll} aria-label="Select all" />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Size</TableHead>
            <TableHead>Uploaded</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {folders.map((f) => (
            <TableRow key={f.path}>
              <TableCell />
              <TableCell>
                <Link href={folderHref(basePath, f.path)} className="flex items-center gap-2 font-medium hover:underline">
                  <Folder className="size-4 text-muted-foreground" />
                  {f.name}
                </Link>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">—</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
            </TableRow>
          ))}
          {files.map((file) => {
            const Icon = fileIconFor(file.fileName);
            return (
              <TableRow key={file.id} data-state={selected.has(file.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox checked={selected.has(file.id)} onCheckedChange={() => onToggle(file.id)} />
                </TableCell>
                <TableCell>
                  <button type="button" onClick={() => onPreview(file)} className="flex items-center gap-2 font-medium hover:underline">
                    <Icon className="size-4 text-muted-foreground" />
                    {file.fileName}
                  </button>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{formatBytes(file.size)}</TableCell>
                <TableCell className="text-muted-foreground">{formatRelativeTime(file.createdAt)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
