"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanSearch } from "lucide-react";
import { navItemsForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = navItemsForRole(role);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ScanSearch className="size-4" />
        </div>
        <span className="text-[0.9375rem] font-semibold tracking-tight">
          Vision Datasets
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        <p className="px-3 pb-1.5 pt-2 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground/70">
          Workspace
        </p>
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              <Icon className={cn("size-4", active ? "text-foreground" : "text-muted-foreground")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
