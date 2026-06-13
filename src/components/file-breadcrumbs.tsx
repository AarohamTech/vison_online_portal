import Link from "next/link";
import { Home, ChevronRight } from "lucide-react";

/** Build href for a given path within the current section browser. */
function hrefFor(basePath: string, path: string): string {
  return path ? `${basePath}?path=${encodeURIComponent(path)}` : basePath;
}

export function FileBreadcrumbs({
  basePath,
  sectionLabel,
  path,
}: {
  basePath: string;
  sectionLabel: string;
  path: string;
}) {
  const segments = path ? path.split("/") : [];
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <Link
        href={hrefFor(basePath, "")}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        <Home className="size-3.5" />
        {sectionLabel}
      </Link>
      {segments.map((seg, i) => {
        const sub = segments.slice(0, i + 1).join("/");
        const isLast = i === segments.length - 1;
        return (
          <span key={sub} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" />
            {isLast ? (
              <span className="font-medium text-foreground">{seg}</span>
            ) : (
              <Link href={hrefFor(basePath, sub)} className="hover:text-foreground">
                {seg}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
