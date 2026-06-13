import type { Section } from "@/types";

type BrowsableSection = Exclude<Section, "metadata">;

export const SECTION_SLUG: Record<BrowsableSection, string> = {
  train_data: "train-data",
  annotated: "annotated",
  installer: "installer",
};

export const SLUG_TO_SECTION: Record<string, BrowsableSection> = {
  "train-data": "train_data",
  annotated: "annotated",
  installer: "installer",
};

export const SECTION_LABEL: Record<Section, string> = {
  train_data: "Train Data",
  annotated: "Annotated",
  installer: "Installer",
  metadata: "Metadata",
};

export function sectionFromSlug(slug: string): BrowsableSection | null {
  return SLUG_TO_SECTION[slug] ?? null;
}
