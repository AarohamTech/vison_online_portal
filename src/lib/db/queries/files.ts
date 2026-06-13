import "server-only";
import { and, asc, eq, inArray, isNull, like, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { files, folders } from "@/lib/db/schema";
import type { FileItem, Section } from "@/types";

type FileRow = typeof files.$inferSelect;

export function toFileItem(row: FileRow): FileItem {
  return {
    id: row.id,
    projectId: row.projectId,
    bucket: row.bucket,
    objectKey: row.objectKey,
    fileName: row.fileName,
    fileType: row.fileType,
    mimeType: row.mimeType,
    size: row.size,
    section: row.section,
    folderPath: row.folderPath,
    uploadedBy: row.uploadedBy ?? "",
    assignedTo: row.assignedTo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

const KEEP = ".keep";

export interface DirEntryFolder {
  name: string;
  path: string;
}

export interface DirectoryListing {
  folders: DirEntryFolder[];
  files: FileItem[];
}

/** All non-deleted folder paths used by files in a section (for the tree). */
export async function getSectionFolderPaths(
  projectId: string,
  section: Section
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ folderPath: files.folderPath })
    .from(files)
    .where(
      and(
        eq(files.projectId, projectId),
        eq(files.section, section),
        isNull(files.deletedAt)
      )
    );
  const explicit = await db
    .select({ path: folders.path })
    .from(folders)
    .where(and(eq(folders.projectId, projectId), eq(folders.section, section)));

  const set = new Set<string>();
  for (const r of rows) if (r.folderPath) set.add(r.folderPath);
  for (const r of explicit) if (r.path) set.add(r.path);
  return [...set].sort();
}

/** Immediate child segment of `path` from a descendant path, or null. */
function childSegment(descendant: string, path: string): string | null {
  if (path === "") {
    if (!descendant) return null;
    return descendant.split("/")[0];
  }
  const prefix = path + "/";
  if (!descendant.startsWith(prefix)) return null;
  const rest = descendant.slice(prefix.length);
  return rest ? rest.split("/")[0] : null;
}

/** List immediate folders + files at a path within a section. */
export async function listDirectory(
  projectId: string,
  section: Section,
  path: string
): Promise<DirectoryListing> {
  const normPath = path.replace(/^\/+|\/+$/g, "");

  // Files directly at this level.
  const fileRows = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.projectId, projectId),
        eq(files.section, section),
        eq(files.folderPath, normPath),
        isNull(files.deletedAt)
      )
    )
    .orderBy(asc(files.fileName));

  // Descendant folder paths (to derive immediate child folders).
  const descendantWhere =
    normPath === ""
      ? undefined
      : or(eq(files.folderPath, normPath), like(files.folderPath, `${normPath}/%`));

  const folderPathRows = await db
    .selectDistinct({ folderPath: files.folderPath })
    .from(files)
    .where(
      and(
        eq(files.projectId, projectId),
        eq(files.section, section),
        isNull(files.deletedAt),
        ...(descendantWhere ? [descendantWhere] : [])
      )
    );

  const explicitFolders = await db
    .select({ name: folders.name, path: folders.path, parentPath: folders.parentPath })
    .from(folders)
    .where(
      and(
        eq(folders.projectId, projectId),
        eq(folders.section, section),
        normPath === "" ? isNull(folders.parentPath) : eq(folders.parentPath, normPath)
      )
    );

  const childNames = new Set<string>();
  for (const r of folderPathRows) {
    const seg = childSegment(r.folderPath, normPath);
    if (seg) childNames.add(seg);
  }
  for (const r of explicitFolders) childNames.add(r.name);

  const childFolders: DirEntryFolder[] = [...childNames]
    .sort()
    .map((name) => ({ name, path: normPath ? `${normPath}/${name}` : name }));

  const visibleFiles = fileRows
    .map(toFileItem)
    .filter((f) => f.fileName !== KEEP);

  return { folders: childFolders, files: visibleFiles };
}

export async function getFileById(id: string): Promise<FileItem | null> {
  const rows = await db.select().from(files).where(eq(files.id, id)).limit(1);
  return rows[0] ? toFileItem(rows[0]) : null;
}

/**
 * All non-deleted files under an optional section + folder-path prefix.
 * Used for ZIP collection. Omit section/path to get the whole project.
 */
export async function listFilesUnder(
  projectId: string,
  section?: Section,
  pathPrefix?: string
): Promise<FileItem[]> {
  const conds = [eq(files.projectId, projectId), isNull(files.deletedAt)];
  if (section) conds.push(eq(files.section, section));
  if (pathPrefix) {
    conds.push(
      or(eq(files.folderPath, pathPrefix), like(files.folderPath, `${pathPrefix}/%`))!
    );
  }
  const rows = await db.select().from(files).where(and(...conds));
  return rows.map(toFileItem).filter((f) => f.fileName !== KEEP);
}

export async function listFilesByIds(
  projectId: string,
  ids: string[]
): Promise<FileItem[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.projectId, projectId),
        isNull(files.deletedAt),
        inArray(files.id, ids)
      )
    );
  return rows.map(toFileItem).filter((f) => f.fileName !== KEEP);
}
