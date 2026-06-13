/**
 * Centralized permission helpers — the SINGLE SOURCE OF TRUTH for what each
 * role may do. Both the UI (to hide actions) and server actions (to enforce)
 * import from here. UI hiding is convenience; the server check is the gate.
 *
 * Capability is driven by the user's GLOBAL role. Scope/access to a specific
 * project is driven by the user's ProjectMember row (membership). Admins
 * bypass membership entirely.
 *
 * Policy decisions encoded here (flagged for review):
 *  - Annotators cannot upload images by default (spec: "unless explicitly
 *    allowed by admin" — not yet modeled; defaults to false).
 *  - Maintainers MAY create AND delete subfolders within train_data/annotated.
 *  - Only admins ever touch the installer section (view, manage, download).
 */

import type { ProjectMember, Role, Section } from "@/types";

/** Minimal user shape needed for permission checks. */
export interface PermissionUser {
  role: Role;
}

/**
 * The user's membership in the project being acted on, or null if none.
 * Admins ignore this. Non-admins with null membership have no access.
 */
export type Membership = ProjectMember | null | undefined;

const isAdmin = (u: PermissionUser) => u.role === "admin";
const isMaintainer = (u: PermissionUser) => u.role === "maintainer";
const isAnnotator = (u: PermissionUser) => u.role === "annotator";

/** Section helper: the installer section is admin-only across the board. */
export const isInstallerSection = (section: Section) => section === "installer";

/** Sections a maintainer is allowed to operate within. */
const MAINTAINER_SECTIONS: Section[] = ["train_data", "annotated"];

// ---------------------------------------------------------------------------
// Project access
// ---------------------------------------------------------------------------

/** Whether the user can access the project at all. Admins: always. */
export function canAccessProject(
  user: PermissionUser,
  membership: Membership
): boolean {
  if (isAdmin(user)) return true;
  return Boolean(membership);
}

/** Whether the user should see a given section/tab. */
export function canViewSection(
  user: PermissionUser,
  membership: Membership,
  section: Section
): boolean {
  if (isAdmin(user)) return true;
  if (!membership) return false;
  if (isInstallerSection(section)) return false; // installer is admin-only
  if (isMaintainer(user)) return true; // train_data, annotated, metadata
  // annotator: train_data (view images) and annotated (their labels)
  return section === "train_data" || section === "annotated";
}

// ---------------------------------------------------------------------------
// Installer
// ---------------------------------------------------------------------------

export function canViewInstaller(user: PermissionUser): boolean {
  return isAdmin(user);
}

export function canManageInstaller(user: PermissionUser): boolean {
  return isAdmin(user);
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export function canUploadImages(
  user: PermissionUser,
  membership: Membership
): boolean {
  if (isAdmin(user)) return true;
  if (!membership) return false;
  if (isMaintainer(user)) return true;
  // annotators only if explicitly granted by an admin on their membership
  return isAnnotator(user) && membership.canUploadImages === true;
}

export function canDeleteImages(
  user: PermissionUser,
  membership: Membership
): boolean {
  if (isAdmin(user)) return true;
  if (!membership) return false;
  return isMaintainer(user); // annotators cannot delete
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export function canUploadLabels(
  user: PermissionUser,
  membership: Membership
): boolean {
  if (isAdmin(user)) return true;
  if (!membership) return false;
  return isMaintainer(user) || isAnnotator(user);
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export function canCreateFolder(
  user: PermissionUser,
  membership: Membership,
  section: Section
): boolean {
  if (isAdmin(user)) return true;
  if (!membership) return false;
  if (isMaintainer(user)) return MAINTAINER_SECTIONS.includes(section);
  return false; // annotators cannot create folders
}

export function canDeleteFolder(
  user: PermissionUser,
  membership: Membership,
  section: Section
): boolean {
  if (isAdmin(user)) return true;
  if (!membership) return false;
  if (isMaintainer(user)) return MAINTAINER_SECTIONS.includes(section);
  return false;
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

export function canDownloadFolder(
  user: PermissionUser,
  membership: Membership,
  section: Section
): boolean {
  if (isAdmin(user)) return true;
  if (!membership) return false;
  if (isInstallerSection(section)) return false; // never for non-admin
  if (!membership.canDownload) return false;
  if (isMaintainer(user)) return true; // train_data, annotated
  // annotator: only assigned image/label areas, when download enabled
  return section === "train_data" || section === "annotated";
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function canManageUsers(user: PermissionUser): boolean {
  return isAdmin(user);
}

export function canManageProjects(user: PermissionUser): boolean {
  return isAdmin(user);
}
