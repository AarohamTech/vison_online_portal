import {
  FileText,
  FileJson,
  FileCode,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  FileCog,
  File as FileIcon,
  type LucideIcon,
} from "lucide-react";
import { getExtension } from "@/lib/validation/files";

const MAP: Record<string, LucideIcon> = {
  jpg: FileImage, jpeg: FileImage, png: FileImage, bmp: FileImage,
  tif: FileImage, tiff: FileImage, webp: FileImage, gif: FileImage,
  json: FileJson,
  xml: FileCode, yaml: FileCode, yml: FileCode,
  csv: FileSpreadsheet,
  txt: FileText, md: FileText,
  zip: FileArchive, "7z": FileArchive, rar: FileArchive,
  exe: FileCog, msi: FileCog, dll: FileCog, bat: FileCog, sh: FileCog,
};

export function fileIconFor(fileName: string): LucideIcon {
  return MAP[getExtension(fileName)] ?? FileIcon;
}
