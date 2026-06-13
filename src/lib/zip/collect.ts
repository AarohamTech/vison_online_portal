import "server-only";
import { loadAccessContext } from "@/lib/projects/access";
import { getProjectById } from "@/lib/db/queries/projects";
import { listFilesUnder, listFilesByIds } from "@/lib/db/queries/files";
import { canAccessProject, canDownloadFolder, canViewInstaller } from "@/lib/permissions";
import { metadataKey, projectPrefix } from "@/lib/s3/keys";
import { sectionFromSlug } from "@/lib/sections";
import type { Section } from "@/types";

export interface ZipEntry {
  key: string;
  /** Path inside the archive (structure preserved). */
  zipPath: string;
}

export interface ZipPlan {
  entries: ZipEntry[];
  filename: string;
}

export type ZipScope = "project" | "section" | "folder" | "selection";

export interface ZipRequest {
  projectId: string;
  scope: ZipScope;
  /** section slug for section/folder scope */
  sectionSlug?: string;
  /** folder path for folder scope */
  path?: string;
  /** file ids for selection scope */
  ids?: string[];
}

function safeName(s: string): string {
  return s.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "download";
}

/** zipPath = object key minus the project prefix (keeps installer/train-data/… structure). */
function toZipPath(projectId: string, key: string): string {
  const prefix = projectPrefix(projectId);
  return key.startsWith(prefix) ? key.slice(prefix.length) : key;
}

export class ZipForbiddenError extends Error {}
export class ZipEmptyError extends Error {}

/**
 * Build a permission-filtered list of S3 objects to include in a ZIP.
 * Throws ZipForbiddenError / ZipEmptyError on access or empty issues.
 */
export async function planZip(req: ZipRequest): Promise<ZipPlan> {
  const { user, membership } = await loadAccessContext(req.projectId);
  if (!canAccessProject(user, membership)) throw new ZipForbiddenError();

  const project = await getProjectById(req.projectId);
  if (!project) throw new ZipForbiddenError();

  const includeSection = (section: Section) =>
    canDownloadFolder(user, membership, section);

  let files: { objectKey: string; section: Section }[] = [];
  let label = "files";

  if (req.scope === "selection") {
    const picked = await listFilesByIds(req.projectId, req.ids ?? []);
    files = picked.map((f) => ({ objectKey: f.objectKey, section: f.section }));
    label = "selection";
  } else if (req.scope === "folder" || req.scope === "section") {
    const section = req.sectionSlug ? sectionFromSlug(req.sectionSlug) : null;
    if (!section) throw new ZipForbiddenError();
    if (!includeSection(section)) throw new ZipForbiddenError();
    const path = req.scope === "folder" ? req.path : undefined;
    const list = await listFilesUnder(req.projectId, section, path);
    files = list.map((f) => ({ objectKey: f.objectKey, section: f.section }));
    label = req.scope === "folder" && path ? path.split("/").pop()! : section;
  } else {
    // whole project — only sections the user may download
    const all = await listFilesUnder(req.projectId);
    files = all.map((f) => ({ objectKey: f.objectKey, section: f.section }));
    label = "project";
  }

  // Permission filter per section (also covers selection spanning sections).
  const entries: ZipEntry[] = files
    .filter((f) => includeSection(f.section))
    .map((f) => ({ key: f.objectKey, zipPath: toZipPath(req.projectId, f.objectKey) }));

  // Admin full-project zip also includes metadata.json.
  if (req.scope === "project" && canViewInstaller(user)) {
    entries.push({ key: metadataKey(req.projectId), zipPath: "metadata.json" });
  }

  if (entries.length === 0) throw new ZipEmptyError();

  const filename = `${safeName(project.name)}_${safeName(label)}.zip`;
  return { entries, filename };
}
