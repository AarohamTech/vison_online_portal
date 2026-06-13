import { describe, it, expect } from "vitest";
import {
  sanitizeSegment,
  normalizeRelativePath,
  splitPath,
  buildObjectKey,
  metadataKey,
  projectPrefix,
  sectionPrefix,
} from "@/lib/s3/keys";

describe("normalizeRelativePath", () => {
  it("cleans and normalizes", () => {
    expect(normalizeRelativePath("a//b/./c")).toBe("a/b/c");
    expect(normalizeRelativePath("\\a\\b\\")).toBe("a/b");
    expect(normalizeRelativePath("")).toBe("");
  });
  it("blocks path traversal", () => {
    expect(() => normalizeRelativePath("a/../b")).toThrow();
    expect(() => normalizeRelativePath("../etc/passwd")).toThrow();
  });
});

describe("sanitizeSegment", () => {
  it("strips illegal chars and leading dots", () => {
    expect(sanitizeSegment("..hidden")).toBe("hidden");
    expect(sanitizeSegment("a<b>c")).toBe("abc");
    expect(sanitizeSegment("..")).toBe("");
  });
});

describe("splitPath", () => {
  it("separates folder and file", () => {
    expect(splitPath("a/b/c.png")).toEqual({ folder: "a/b", fileName: "c.png" });
    expect(splitPath("c.png")).toEqual({ folder: "", fileName: "c.png" });
  });
});

describe("buildObjectKey", () => {
  it("train_data preserves structure under raw", () => {
    expect(
      buildObjectKey({ projectId: "P", section: "train_data", subPath: "defect/ok", fileName: "i.png" })
    ).toBe("projects/P/train-data/raw/defect/ok/i.png");
  });
  it("annotated requires userId and scopes under it", () => {
    expect(
      buildObjectKey({ projectId: "P", section: "annotated", subPath: "sub", fileName: "l.json", userId: "U" })
    ).toBe("projects/P/annotated/final_labels/U/sub/l.json");
    expect(() =>
      buildObjectKey({ projectId: "P", section: "annotated", fileName: "l.json" })
    ).toThrow();
  });
  it("installer key", () => {
    expect(
      buildObjectKey({ projectId: "P", section: "installer", subPath: "v1.0", fileName: "setup.exe" })
    ).toBe("projects/P/installer/v1.0/setup.exe");
  });
  it("rejects traversal in subPath", () => {
    expect(() =>
      buildObjectKey({ projectId: "P", section: "train_data", subPath: "../x", fileName: "a.png" })
    ).toThrow();
  });
});

describe("prefixes", () => {
  it("metadata/project/section prefixes", () => {
    expect(metadataKey("P")).toBe("projects/P/metadata.json");
    expect(projectPrefix("P")).toBe("projects/P/");
    expect(sectionPrefix("P", "train_data")).toBe("projects/P/train-data/raw/");
    expect(sectionPrefix("P", "annotated", "U/sub")).toBe("projects/P/annotated/final_labels/U/sub/");
  });
});
