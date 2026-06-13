/**
 * S3 object-key construction and path normalization.
 *
 * Security-critical: every user-supplied path (folder names, webkitRelativePath)
 * flows through normalizeRelativePath() before becoming part of a key. This
 * blocks path traversal ("../"), absolute paths, and control characters.
 *
 * Key formats (from spec):
 *   projects/{projectId}/installer/{sub}/{file}
 *   projects/{projectId}/train-data/raw/{sub}/{file}
 *   projects/{projectId}/annotated/final_labels/{userId}/{sub}/{file}
 *   projects/{projectId}/metadata.json
 */

import type { Section } from "@/types";

/** URL/path segment for each section under projects/{id}/. */
export const SECTION_PREFIX: Record<Exclude<Section, "metadata">, string> = {
  installer: "installer",
  train_data: "train-data/raw",
  annotated: "annotated/final_labels",
};

/** Characters not allowed in any path segment. */
// eslint-disable-next-line no-control-regex
const ILLEGAL_SEGMENT_CHARS = /[\x00-\x1f\x7f<>:"\\|?*]/g;

/**
 * Sanitize a single path segment (file or folder name).
 * Returns "" if the segment is empty/invalid after cleaning.
 */
export function sanitizeSegment(segment: string): string {
  const cleaned = segment
    .replace(ILLEGAL_SEGMENT_CHARS, "")
    .replace(/^\.+/, "") // no leading dots (no "." or "..")
    .trim();
  if (cleaned === "" || cleaned === "." || cleaned === "..") return "";
  return cleaned;
}

/**
 * Normalize a user-supplied relative path into a safe "a/b/c" form.
 * Drops empty, ".", and ".." segments. Never returns a leading slash.
 * Throws if a traversal attempt is detected (".." segment present).
 */
export function normalizeRelativePath(input: string): string {
  if (!input) return "";
  const raw = input.replace(/\\/g, "/").split("/");
  const out: string[] = [];
  for (const part of raw) {
    const trimmed = part.trim();
    if (trimmed === "" || trimmed === ".") continue;
    if (trimmed === "..") {
      throw new Error("Path traversal is not allowed.");
    }
    const safe = sanitizeSegment(trimmed);
    if (safe === "") continue;
    out.push(safe);
  }
  return out.join("/");
}

/** Split a relative path into its folder portion and file name. */
export function splitPath(relativePath: string): {
  folder: string;
  fileName: string;
} {
  const normalized = normalizeRelativePath(relativePath);
  const idx = normalized.lastIndexOf("/");
  if (idx === -1) return { folder: "", fileName: normalized };
  return {
    folder: normalized.slice(0, idx),
    fileName: normalized.slice(idx + 1),
  };
}

function join(...parts: Array<string | null | undefined>): string {
  return parts
    .filter((p): p is string => Boolean(p) && p!.length > 0)
    .join("/");
}

export interface BuildKeyArgs {
  projectId: string;
  section: Exclude<Section, "metadata">;
  /** Normalized subfolder within the section, e.g. "defect_dataset/ok". */
  subPath?: string;
  fileName: string;
  /** Required for the annotated section: scopes labels under the user. */
  userId?: string;
}

/**
 * Build a fully-qualified S3 object key for a file upload.
 * All path components are normalized/sanitized here.
 */
export function buildObjectKey(args: BuildKeyArgs): string {
  const projectId = sanitizeSegment(args.projectId);
  if (!projectId) throw new Error("Invalid projectId.");

  const fileName = sanitizeSegment(args.fileName);
  if (!fileName) throw new Error("Invalid fileName.");

  const sub = args.subPath ? normalizeRelativePath(args.subPath) : "";
  const prefix = SECTION_PREFIX[args.section];

  if (args.section === "annotated") {
    const userId = sanitizeSegment(args.userId ?? "");
    if (!userId) throw new Error("annotated section requires a userId.");
    return join("projects", projectId, prefix, userId, sub, fileName);
  }

  return join("projects", projectId, prefix, sub, fileName);
}

/** Key for a project's metadata.json. */
export function metadataKey(projectId: string): string {
  const id = sanitizeSegment(projectId);
  if (!id) throw new Error("Invalid projectId.");
  return `projects/${id}/metadata.json`;
}

/** The key prefix for an entire project (used for project-wide listing/ZIP). */
export function projectPrefix(projectId: string): string {
  const id = sanitizeSegment(projectId);
  if (!id) throw new Error("Invalid projectId.");
  return `projects/${id}/`;
}

/** The key prefix for a section (used for section-wide listing/ZIP). */
export function sectionPrefix(
  projectId: string,
  section: Exclude<Section, "metadata">,
  subPath?: string
): string {
  const id = sanitizeSegment(projectId);
  if (!id) throw new Error("Invalid projectId.");
  const sub = subPath ? normalizeRelativePath(subPath) : "";
  return join("projects", id, SECTION_PREFIX[section], sub) + "/";
}
