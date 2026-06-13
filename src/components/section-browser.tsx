import { redirect } from "next/navigation";
import { assertSectionAccess } from "@/lib/projects/access";
import { listDirectory, getSectionFolderPaths } from "@/lib/db/queries/files";
import { signedDownloadUrl, S3_BUCKET } from "@/lib/s3/client";
import {
  canUploadImages,
  canUploadLabels,
  canDeleteImages,
  canManageInstaller,
  canCreateFolder as canCreateFolderPerm,
  canDownloadFolder,
} from "@/lib/permissions";
import { isImage } from "@/lib/validation/files";
import { SECTION_LABEL, SECTION_SLUG } from "@/lib/sections";
import { normalizeRelativePath } from "@/lib/s3/keys";
import { FolderTree } from "@/components/folder-tree";
import { FileBreadcrumbs } from "@/components/file-breadcrumbs";
import { FileBrowser, type BrowserPermissions } from "@/components/file-browser";
import type { Section } from "@/types";

export async function SectionBrowser({
  projectId,
  section,
  rawPath,
}: {
  projectId: string;
  section: Exclude<Section, "metadata">;
  rawPath: string;
}) {
  let ctx;
  try {
    ctx = await assertSectionAccess(projectId, section);
  } catch {
    redirect(`/projects/${projectId}`);
  }
  const { user, membership } = ctx;

  let currentPath = "";
  try {
    currentPath = normalizeRelativePath(rawPath);
  } catch {
    currentPath = "";
  }

  const [{ folders, files }, allPaths] = await Promise.all([
    listDirectory(projectId, section, currentPath),
    getSectionFolderPaths(projectId, section),
  ]);

  // Signed view URLs for image thumbnails in this directory.
  const imageFiles = files.filter((f) => isImage(f.fileName));
  const urls = await Promise.all(
    imageFiles.map((f) => signedDownloadUrl(f.objectKey, 900))
  );
  const thumbnailUrls: Record<string, string> = {};
  imageFiles.forEach((f, i) => (thumbnailUrls[f.id] = urls[i]));

  const isInstaller = section === "installer";
  const permissions: BrowserPermissions = {
    canUpload: isInstaller
      ? canManageInstaller(user)
      : canUploadImages(user, membership) || canUploadLabels(user, membership),
    canCreateFolder: canCreateFolderPerm(user, membership, section),
    canDelete: isInstaller
      ? canManageInstaller(user)
      : canDeleteImages(user, membership),
    canDownload: canDownloadFolder(user, membership, section),
  };

  const basePath = `/projects/${projectId}/${SECTION_SLUG[section]}`;
  const sectionLabel = SECTION_LABEL[section];

  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
      <aside className="hidden rounded-lg border bg-card p-3 lg:block">
        <FolderTree
          basePath={basePath}
          sectionLabel={sectionLabel}
          paths={allPaths}
          currentPath={currentPath}
        />
      </aside>
      <div className="min-w-0 space-y-4">
        <FileBreadcrumbs basePath={basePath} sectionLabel={sectionLabel} path={currentPath} />
        <FileBrowser
          projectId={projectId}
          section={section}
          bucket={S3_BUCKET}
          basePath={basePath}
          currentPath={currentPath}
          folders={folders}
          files={files}
          thumbnailUrls={thumbnailUrls}
          permissions={permissions}
        />
      </div>
    </div>
  );
}
