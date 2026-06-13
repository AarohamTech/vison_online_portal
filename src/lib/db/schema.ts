/**
 * Drizzle schema — the database source of truth, mirrored by src/types.
 * Plain Postgres (Neon). Row security is enforced in the app layer
 * (server actions + data-access functions), not via Supabase RLS.
 */

import {
  bigint,
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// --- Enums ---
export const roleEnum = pgEnum("role", ["admin", "maintainer", "annotator"]);
export const sectionEnum = pgEnum("section", [
  "installer",
  "train_data",
  "annotated",
  "metadata",
]);
export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "on_hold",
  "archived",
]);
export const labelStatusEnum = pgEnum("label_status", [
  "uploaded",
  "reviewed",
  "rejected",
]);

// --- profiles (users + auth) ---
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name"),
  role: roleEnum("role").notNull().default("annotator"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- projects ---
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  customerName: text("customer_name").notNull(),
  productName: text("product_name").notNull(),
  description: text("description"),
  status: projectStatusEnum("status").notNull().default("active"),
  createdBy: uuid("created_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- project_members ---
export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    canDownload: boolean("can_download").notNull().default(true),
    /** Per-member override letting an annotator upload images (spec). */
    canUploadImages: boolean("can_upload_images").notNull().default(false),
    assignedPaths: text("assigned_paths").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("project_members_project_user_uq").on(t.projectId, t.userId)]
);

// --- files ---
export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull().unique(),
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(),
    mimeType: text("mime_type"),
    size: bigint("size", { mode: "number" }).notNull(),
    section: sectionEnum("section").notNull(),
    folderPath: text("folder_path").notNull().default(""),
    uploadedBy: uuid("uploaded_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    assignedTo: uuid("assigned_to").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("files_project_section_idx").on(t.projectId, t.section),
    index("files_project_folder_idx").on(t.projectId, t.folderPath),
  ]
);

// --- folders ---
export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    path: text("path").notNull(),
    section: sectionEnum("section").notNull(),
    parentPath: text("parent_path"),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("folders_project_section_path_uq").on(
      t.projectId,
      t.section,
      t.path
    ),
  ]
);

// --- label_uploads ---
export const labelUploads = pgTable("label_uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  imageFileId: uuid("image_file_id").references(() => files.id, {
    onDelete: "set null",
  }),
  labelFileId: uuid("label_file_id")
    .notNull()
    .references(() => files.id, { onDelete: "cascade" }),
  uploadedBy: uuid("uploaded_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  status: labelStatusEnum("status").notNull().default("uploaded"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  reviewedBy: uuid("reviewed_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

// --- activity_logs ---
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("activity_logs_project_idx").on(t.projectId, t.createdAt)]
);
