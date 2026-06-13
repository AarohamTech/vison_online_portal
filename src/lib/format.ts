import type { ActivityAction } from "@/types";

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes < 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${units[i]}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.round((then - now) / 1000); // seconds, negative = past
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2592000, "week"],
    [31536000, "month"],
    [Infinity, "year"],
  ];
  const divisors = [1, 60, 3600, 86400, 604800, 2592000, 31536000];
  for (let i = 0; i < steps.length; i++) {
    if (abs < steps[i][0]) {
      return rtf.format(Math.round(diff / divisors[i]), steps[i][1]);
    }
  }
  return formatDate(iso);
}

export const ACTIVITY_LABELS: Record<ActivityAction, string> = {
  project_created: "created project",
  project_updated: "updated project",
  project_deleted: "deleted project",
  file_uploaded: "uploaded a file",
  folder_uploaded: "uploaded a folder",
  file_deleted: "deleted a file",
  folder_created: "created a folder",
  folder_deleted: "deleted a folder",
  zip_downloaded: "downloaded a ZIP",
  label_uploaded: "uploaded a label",
  user_assigned: "assigned a user",
  role_changed: "changed a role",
};
