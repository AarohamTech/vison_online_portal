import { describe, it, expect } from "vitest";
import {
  canViewInstaller,
  canManageInstaller,
  canUploadImages,
  canDeleteImages,
  canUploadLabels,
  canCreateFolder,
  canDeleteFolder,
  canDownloadFolder,
  canManageUsers,
  canAccessProject,
  canViewSection,
} from "@/lib/permissions";
import type { ProjectMember } from "@/types";

const admin = { role: "admin" as const };
const maintainer = { role: "maintainer" as const };
const annotator = { role: "annotator" as const };

function member(over: Partial<ProjectMember> = {}): ProjectMember {
  return {
    id: "m", projectId: "p", userId: "u", role: "annotator",
    canDownload: true, canUploadImages: false, assignedPaths: [],
    createdAt: new Date().toISOString(), ...over,
  };
}

describe("admin", () => {
  it("can do everything regardless of membership", () => {
    expect(canViewInstaller(admin)).toBe(true);
    expect(canManageInstaller(admin)).toBe(true);
    expect(canManageUsers(admin)).toBe(true);
    expect(canAccessProject(admin, null)).toBe(true);
    expect(canUploadImages(admin, null)).toBe(true);
    expect(canDeleteImages(admin, null)).toBe(true);
    expect(canCreateFolder(admin, null, "installer")).toBe(true);
    expect(canDeleteFolder(admin, null, "installer")).toBe(true);
    expect(canDownloadFolder(admin, null, "installer")).toBe(true);
    expect(canViewSection(admin, null, "installer")).toBe(true);
  });
});

describe("installer is admin-only", () => {
  it("hidden/blocked for maintainer and annotator", () => {
    for (const u of [maintainer, annotator]) {
      expect(canViewInstaller(u)).toBe(false);
      expect(canManageInstaller(u)).toBe(false);
      expect(canViewSection(u, member({ role: u.role }), "installer")).toBe(false);
      expect(canDownloadFolder(u, member({ role: u.role }), "installer")).toBe(false);
    }
  });
});

describe("membership gates non-admins", () => {
  it("no membership = no access", () => {
    expect(canAccessProject(maintainer, null)).toBe(false);
    expect(canAccessProject(annotator, null)).toBe(false);
    expect(canUploadLabels(annotator, null)).toBe(false);
    expect(canUploadImages(maintainer, null)).toBe(false);
  });
});

describe("maintainer", () => {
  const m = member({ role: "maintainer" });
  it("manages train_data/annotated but not installer", () => {
    expect(canUploadImages(maintainer, m)).toBe(true);
    expect(canDeleteImages(maintainer, m)).toBe(true);
    expect(canUploadLabels(maintainer, m)).toBe(true);
    expect(canCreateFolder(maintainer, m, "train_data")).toBe(true);
    expect(canCreateFolder(maintainer, m, "annotated")).toBe(true);
    expect(canCreateFolder(maintainer, m, "installer")).toBe(false);
    expect(canDeleteFolder(maintainer, m, "train_data")).toBe(true);
    expect(canManageUsers(maintainer)).toBe(false);
  });
});

describe("annotator", () => {
  it("labels only, no image upload/delete by default", () => {
    const m = member({ role: "annotator" });
    expect(canUploadLabels(annotator, m)).toBe(true);
    expect(canUploadImages(annotator, m)).toBe(false);
    expect(canDeleteImages(annotator, m)).toBe(false);
    expect(canCreateFolder(annotator, m, "train_data")).toBe(false);
    expect(canDeleteFolder(annotator, m, "annotated")).toBe(false);
  });

  it("can upload images only when granted the override", () => {
    expect(canUploadImages(annotator, member({ role: "annotator", canUploadImages: true }))).toBe(true);
  });

  it("download requires canDownload flag", () => {
    expect(canDownloadFolder(annotator, member({ role: "annotator", canDownload: true }), "train_data")).toBe(true);
    expect(canDownloadFolder(annotator, member({ role: "annotator", canDownload: false }), "train_data")).toBe(false);
  });

  it("can view train_data and annotated only", () => {
    const m = member({ role: "annotator" });
    expect(canViewSection(annotator, m, "train_data")).toBe(true);
    expect(canViewSection(annotator, m, "annotated")).toBe(true);
    expect(canViewSection(annotator, m, "installer")).toBe(false);
  });
});
