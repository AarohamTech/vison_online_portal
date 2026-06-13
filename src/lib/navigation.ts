import {
  LayoutDashboard,
  FolderKanban,
  Upload,
  ClipboardList,
  Users,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Roles that may see this item. Empty/undefined = all roles. */
  roles?: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  {
    label: "Uploads",
    href: "/uploads",
    icon: Upload,
    roles: ["admin", "maintainer"],
  },
  {
    label: "My Assignments",
    href: "/assignments",
    icon: ClipboardList,
    roles: ["annotator"],
  },
  { label: "Users", href: "/users", icon: Users, roles: ["admin"] },
  { label: "Activity Logs", href: "/activity", icon: ScrollText, roles: ["admin"] },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function navItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
