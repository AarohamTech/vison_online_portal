"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Folder, FolderOpen, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
}

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: [] };
  for (const p of paths) {
    if (!p) continue;
    const segs = p.split("/");
    let node = root;
    let acc = "";
    for (const seg of segs) {
      acc = acc ? `${acc}/${seg}` : seg;
      let child = node.children.find((c) => c.name === seg);
      if (!child) {
        child = { name: seg, path: acc, children: [] };
        node.children.push(child);
      }
      node = child;
    }
  }
  const sortRec = (n: TreeNode) => {
    n.children.sort((a, b) => a.name.localeCompare(b.name));
    n.children.forEach(sortRec);
  };
  sortRec(root);
  return root;
}

function hrefFor(basePath: string, path: string): string {
  return path ? `${basePath}?path=${encodeURIComponent(path)}` : basePath;
}

function TreeItem({
  node,
  basePath,
  currentPath,
  depth,
}: {
  node: TreeNode;
  basePath: string;
  currentPath: string;
  depth: number;
}) {
  const onPath =
    currentPath === node.path || currentPath.startsWith(node.path + "/");
  const [open, setOpen] = useState(onPath);
  const active = currentPath === node.path;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md pr-2 text-sm",
          active ? "bg-primary/10 text-primary" : "hover:bg-muted"
        )}
        style={{ paddingLeft: depth * 12 }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn("p-1", !hasChildren && "invisible")}
          aria-label={open ? "Collapse" : "Expand"}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
        </button>
        <Link href={hrefFor(basePath, node.path)} className="flex flex-1 items-center gap-1.5 py-1">
          {open && hasChildren ? <FolderOpen className="size-4" /> : <Folder className="size-4" />}
          <span className="truncate">{node.name}</span>
        </Link>
      </div>
      {open &&
        node.children.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            basePath={basePath}
            currentPath={currentPath}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

export function FolderTree({
  basePath,
  sectionLabel,
  paths,
  currentPath,
}: {
  basePath: string;
  sectionLabel: string;
  paths: string[];
  currentPath: string;
}) {
  const tree = useMemo(() => buildTree(paths), [paths]);

  return (
    <div className="space-y-0.5">
      <Link
        href={hrefFor(basePath, "")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium",
          currentPath === "" ? "bg-primary/10 text-primary" : "hover:bg-muted"
        )}
      >
        <Home className="size-4" />
        {sectionLabel}
      </Link>
      {tree.children.map((child) => (
        <TreeItem
          key={child.path}
          node={child}
          basePath={basePath}
          currentPath={currentPath}
          depth={0}
        />
      ))}
    </div>
  );
}
