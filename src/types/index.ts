/**
 * Core domain types for Vision Dataset Manager.
 *
 * These mirror the Supabase schema (see db/migrations) and are the single
 * source of truth for the shape of data passed between server and client.
 */

// ---------------------------------------------------------------------------
// Roles & sections
// ---------------------------------------------------------------------------

export type Role = "admin" | "maintainer" | "annotator";

export const ROLES: Role[] = ["admin", "maintainer", "annotator"];

/**
 * Top-level sections of a project's fixed folder structure.
 * `metadata` is the project's metadata.json (not a browsable folder).
 */
export type Section = "installer" | "train_data" | "annotated" | "metadata";

export const SECTIONS: Section[] = [
  "installer",
  "train_data",
  "annotated",
  "metadata",
];

export type ProjectStatus = "active" | "on_hold" | "archived";

export const PROJECT_STATUSES: ProjectStatus[] = [
  "active",
  "on_hold",
  "archived",
];

export type LabelStatus = "uploaded" | "reviewed" | "rejected";

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  customerName: string;
  productName: string;
  description: string | null;
  status: ProjectStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;

  // Aggregates (optional; populated by list/detail queries)
  totalImages?: number;
  totalLabels?: number;
  storageBytes?: number;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  /** Project-scoped role. Governs access scope; global role governs capability. */
  role: Role;
  canDownload: boolean;
  /** Per-member override letting an annotator upload images (admin-granted). */
  canUploadImages: boolean;
  /** Folder paths an annotator is restricted to (empty = whole assigned project). */
  assignedPaths: string[];
  createdAt: string;
}

export interface FileItem {
  id: string;
  projectId: string;
  bucket: string;
  objectKey: string;
  fileName: string;
  /** Lowercase extension without dot, e.g. "jpg", "json". */
  fileType: string;
  mimeType: string | null;
  size: number;
  section: Section;
  /** Normalized folder path within the section, e.g. "raw/defect_dataset/ok". */
  folderPath: string;
  uploadedBy: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface FolderItem {
  id: string;
  projectId: string;
  name: string;
  /** Full normalized path within the section. */
  path: string;
  section: Exclude<Section, "metadata">;
  parentPath: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabelUpload {
  id: string;
  projectId: string;
  imageFileId: string | null;
  labelFileId: string;
  uploadedBy: string;
  status: LabelStatus;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export type ActivityAction =
  | "project_created"
  | "project_updated"
  | "project_deleted"
  | "file_uploaded"
  | "folder_uploaded"
  | "file_deleted"
  | "folder_created"
  | "folder_deleted"
  | "zip_downloaded"
  | "label_uploaded"
  | "user_assigned"
  | "role_changed";

export interface ActivityLog {
  id: string;
  projectId: string | null;
  userId: string;
  action: ActivityAction;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Project metadata.json contract
// ---------------------------------------------------------------------------

export interface ProjectMetadata {
  projectId: string;
  projectName: string;
  customerName: string;
  productName: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  folderStructureVersion: string;
}
