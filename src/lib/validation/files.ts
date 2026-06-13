/**
 * File-type validation rules. Used on both client (pre-upload UX) and server
 * (the enforced gate). Extension + role together decide if an upload is legal.
 */

import type { Role, Section } from "@/types";

export const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "bmp",
  "tif",
  "tiff",
  "webp",
] as const;

export const LABEL_EXTENSIONS = [
  "txt",
  "json",
  "xml",
  "csv",
  "yaml",
  "yml",
] as const;

/** Installer section accepts these (admin only). */
export const INSTALLER_EXTENSIONS = [
  "exe",
  "msi",
  "zip",
  "7z",
  "rar",
  "dll",
  "bat",
  "sh",
  "txt",
  "md",
] as const;

/**
 * Executable / installer extensions that non-admins must NEVER upload,
 * regardless of destination section.
 */
export const BLOCKED_FOR_NON_ADMIN = [
  "exe",
  "msi",
  "bat",
  "sh",
  "dll",
  "com",
  "cmd",
  "ps1",
  "msp",
  "scr",
] as const;

export type FileCategory = "image" | "label" | "installer" | "other";

/** Extract a normalized, lowercase extension (no dot). "" if none. */
export function getExtension(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return ""; // no ext, or dotfile like ".gitignore"
  return base.slice(dot + 1).toLowerCase();
}

export function categorize(fileName: string): FileCategory {
  const ext = getExtension(fileName);
  if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) return "image";
  if ((LABEL_EXTENSIONS as readonly string[]).includes(ext)) return "label";
  if ((INSTALLER_EXTENSIONS as readonly string[]).includes(ext))
    return "installer";
  return "other";
}

export function isImage(fileName: string): boolean {
  return (IMAGE_EXTENSIONS as readonly string[]).includes(
    getExtension(fileName)
  );
}

export function isLabel(fileName: string): boolean {
  return (LABEL_EXTENSIONS as readonly string[]).includes(
    getExtension(fileName)
  );
}

export function isBlockedForNonAdmin(fileName: string): boolean {
  return (BLOCKED_FOR_NON_ADMIN as readonly string[]).includes(
    getExtension(fileName)
  );
}

/** Allowed extensions for a (role, section) combination. */
export function allowedExtensions(role: Role, section: Section): string[] {
  if (section === "installer") {
    return role === "admin" ? [...INSTALLER_EXTENSIONS] : [];
  }
  if (section === "train_data") {
    // images, plus labels (raw data can carry sidecar labels)
    const base = [...IMAGE_EXTENSIONS, ...LABEL_EXTENSIONS];
    return role === "annotator" ? [...LABEL_EXTENSIONS] : base;
  }
  if (section === "annotated") {
    // labels for everyone; maintainers/admins may also place images
    return role === "annotator"
      ? [...LABEL_EXTENSIONS]
      : [...LABEL_EXTENSIONS, ...IMAGE_EXTENSIONS];
  }
  return [];
}

export interface UploadValidationResult {
  ok: boolean;
  /** Stable machine code for the failure, for i18n/testing. */
  code?:
    | "blocked_executable"
    | "extension_not_allowed"
    | "empty_filename"
    | "too_large";
  /** Human-readable message (matches spec copy where specified). */
  message?: string;
}

const BLOCKED_MESSAGE =
  "You do not have permission to upload installer or executable files.";

export interface ValidateOptions {
  maxBytes?: number;
}

/**
 * The enforced gate. Validates a single file for a role + destination section.
 * Call this server-side before issuing a signed upload URL.
 */
export function validateUpload(
  fileName: string,
  fileSize: number,
  role: Role,
  section: Section,
  opts: ValidateOptions = {}
): UploadValidationResult {
  if (!fileName || !fileName.trim()) {
    return { ok: false, code: "empty_filename", message: "Empty filename." };
  }

  // Hard executable block for non-admins, independent of section.
  if (role !== "admin" && isBlockedForNonAdmin(fileName)) {
    return { ok: false, code: "blocked_executable", message: BLOCKED_MESSAGE };
  }

  const allowed = allowedExtensions(role, section);
  const ext = getExtension(fileName);
  if (!allowed.includes(ext)) {
    return {
      ok: false,
      code: "extension_not_allowed",
      message: `Files of type ".${ext || "?"}" are not allowed in this section.`,
    };
  }

  if (opts.maxBytes != null && fileSize > opts.maxBytes) {
    return { ok: false, code: "too_large", message: "File exceeds size limit." };
  }

  return { ok: true };
}
