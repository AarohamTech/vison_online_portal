import { describe, it, expect } from "vitest";
import {
  getExtension,
  categorize,
  isImage,
  isLabel,
  isBlockedForNonAdmin,
  allowedExtensions,
  validateUpload,
} from "@/lib/validation/files";

describe("getExtension", () => {
  it("extracts lowercase extension", () => {
    expect(getExtension("Photo.JPG")).toBe("jpg");
    expect(getExtension("a/b/c.tar.gz")).toBe("gz");
    expect(getExtension("noext")).toBe("");
    expect(getExtension(".gitignore")).toBe("");
    expect(getExtension("path\\to\\file.PNG")).toBe("png");
  });
});

describe("categorize", () => {
  it("classifies files", () => {
    expect(categorize("a.png")).toBe("image");
    expect(categorize("a.json")).toBe("label");
    expect(categorize("a.exe")).toBe("installer");
    expect(categorize("a.unknown")).toBe("other");
    expect(isImage("x.webp")).toBe(true);
    expect(isLabel("x.csv")).toBe(true);
  });
});

describe("isBlockedForNonAdmin", () => {
  it("flags executables", () => {
    for (const f of ["setup.exe", "x.msi", "run.bat", "go.sh", "lib.dll", "a.ps1"]) {
      expect(isBlockedForNonAdmin(f)).toBe(true);
    }
    expect(isBlockedForNonAdmin("img.png")).toBe(false);
  });
});

describe("allowedExtensions", () => {
  it("installer only for admin", () => {
    expect(allowedExtensions("admin", "installer")).toContain("exe");
    expect(allowedExtensions("maintainer", "installer")).toEqual([]);
    expect(allowedExtensions("annotator", "installer")).toEqual([]);
  });
  it("annotator limited to labels in data sections", () => {
    expect(allowedExtensions("annotator", "train_data")).toContain("json");
    expect(allowedExtensions("annotator", "train_data")).not.toContain("png");
    expect(allowedExtensions("maintainer", "train_data")).toContain("png");
  });
});

describe("validateUpload", () => {
  it("blocks executables for non-admins with the exact message", () => {
    const r = validateUpload("setup.exe", 10, "maintainer", "train_data");
    expect(r.ok).toBe(false);
    expect(r.code).toBe("blocked_executable");
    expect(r.message).toBe("You do not have permission to upload installer or executable files.");
  });
  it("allows admin installer exe", () => {
    expect(validateUpload("setup.exe", 10, "admin", "installer").ok).toBe(true);
  });
  it("rejects disallowed extension in section", () => {
    const r = validateUpload("photo.png", 10, "annotator", "train_data");
    expect(r.ok).toBe(false);
    expect(r.code).toBe("extension_not_allowed");
  });
  it("accepts a valid label upload", () => {
    expect(validateUpload("labels.json", 10, "annotator", "annotated").ok).toBe(true);
  });
  it("enforces size limit", () => {
    const r = validateUpload("a.png", 999, "maintainer", "train_data", { maxBytes: 100 });
    expect(r.code).toBe("too_large");
  });
});
