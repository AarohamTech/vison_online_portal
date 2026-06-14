# Vision Dataset Manager — Progress

Internal dataset management platform for vision-inspection image datasets.
Role-based (Admin / Maintainer / Annotator), Supabase auth + Postgres,
AWS S3 storage, server-enforced permissions.

**Approach:** real architecture, backend wired incrementally (not mock-first).
**Rule:** architecture changes are discussed before being made.

> **Architecture change (2026-06-13, approved):** The provided credentials were
> **Neon Postgres**, not Supabase. Pivoted: **Auth.js (NextAuth v5)** replaces
> Supabase Auth, **Drizzle ORM** replaces the Supabase client, and row security
> is enforced in the **app layer** (server actions + data-access) instead of
> Supabase RLS. The permissions module is auth-agnostic and carried over intact.
>
> The Neon DB held an empty prior-project schema + Better Auth tables (0 rows);
> wiped clean with approval (see db/PRE_WIPE_NOTE.md).

---

## Stack (locked)

- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript
- Tailwind v4 · shadcn/ui (radix base) · lucide-react
- **Neon Postgres** + **Drizzle ORM** (`postgres` driver) — DB + migrations
- **Auth.js v5** (Credentials + bcrypt, JWT sessions) — auth
- AWS S3 (`@aws-sdk/client-s3`, presigner) — direct browser uploads via signed URLs
- `archiver` — server-side streaming ZIP
- `zod` — input validation

## Architecture map

```
src/
  app/                     # routes (App Router)
  components/ui/           # shadcn primitives
  components/              # feature components (to build)
  lib/
    permissions/           # ✅ single source of truth for role rules
    validation/            # ✅ file-type / extension rules
    s3/                    # ✅ key builder + path normalization (traversal-safe)
    supabase/              # (Phase 1) server + browser clients
    zip/                   # (Phase 6) streaming ZIP
  types/                   # ✅ domain types
db/                        # (Phase 2) SQL migrations + RLS
```

---

## Phases

| # | Phase | Status |
|---|-------|--------|
| 0 | Scaffold + foundation modules | ✅ Done |
| 2 | DB schema + Drizzle migrations (Neon) | ✅ Done |
| 1 | Auth (Auth.js login, role redirect, route guards) | ✅ Done |
| 3 | App shell (sidebar, topbar, dashboard, projects, create-project) | ✅ Done |
| 4 | File browser (tree, grid/table, signed thumbnails, preview) | ✅ Done |
| 5 | Uploads (direct-to-S3, folder preserve, validation, dup handling) | 🟡 Built · browser test needs CORS |
| 6 | ZIP downloads (streaming, role-scoped) | ✅ Done |
| 7 | Users, assignments, activity logs | ✅ Done |
| 8 | Testing (unit + integration + e2e smoke) | ✅ Done |

> Phases 1 & 2 were done together (auth needs the DB). Order above reflects that.

---

## Phase 0 — Done

- Scaffolded Next.js 16 + TS + Tailwind v4 + shadcn/ui (22 UI components).
- Installed Supabase, AWS S3 SDK, archiver, zod.
- `src/types/index.ts` — User, Project, ProjectMember, FileItem, FolderItem,
  LabelUpload, ActivityLog, ProjectMetadata + role/section/status enums.
- `src/lib/permissions/index.ts` — all spec permission helpers
  (`canViewInstaller`, `canManageInstaller`, `canUploadImages`,
  `canDeleteImages`, `canUploadLabels`, `canCreateFolder`, `canDeleteFolder`,
  `canDownloadFolder`, `canManageUsers`) + `canAccessProject`, `canViewSection`.
- `src/lib/validation/files.ts` — allowed image/label/installer extensions,
  non-admin executable blocklist, `validateUpload()` gate.
- `src/lib/s3/keys.ts` — `buildObjectKey()`, `normalizeRelativePath()`
  (traversal-safe), section prefixes, metadata/project/section prefixes.
- `.env.example` template.

### Policy decisions made in Phase 0 (please confirm at checkpoint)

1. **Annotators cannot upload images** by default (spec allows "if explicitly
   allowed by admin" — not yet modeled). Confirm whether to add a per-member
   `can_upload_images` flag later.
2. **Maintainers may create AND delete subfolders** within train_data /
   annotated. (Spec explicitly grants create; delete inferred.)
3. **Installer is fully admin-only** — view, manage, upload, download.

---

## Phase 2 — Done (DB)

- `src/lib/db/schema.ts` — 7 tables + 4 enums (role, section, project_status,
  label_status). `profiles` carries `password_hash` (we own auth).
- `src/lib/db/index.ts` — Drizzle client (postgres.js, pooled DATABASE_URL).
- `drizzle.config.ts` + `db/migrations/` — generated & applied to Neon.
- Scripts: `db:generate`, `db:migrate`, `db:push`, `db:studio`, `db:seed`.
- Added `project_members.can_upload_images` flag (annotator image-upload
  override) — wired into `canUploadImages()`.

## Phase 1 — Done (Auth)

- `src/lib/auth/config.ts` — edge-safe config (callbacks, pages); keeps proxy
  on the edge (no bcrypt/DB).
- `src/lib/auth/index.ts` — NextAuth + Credentials provider (bcrypt verify,
  constant-time-ish miss), JWT carries id+role.
- `src/lib/auth/actions.ts` — `authenticate` / `logout` server actions.
- `src/proxy.ts` — Next 16 proxy (was middleware) gating all routes → /login.
- `src/app/(auth)/login/` — login page + client form (error/loading states).
- `src/app/(app)/dashboard/page.tsx` — minimal authed page (placeholder).
- `src/types/next-auth.d.ts` — session.user.{id,role} augmentation.
- `db/seed.mjs` — idempotent admin seeder.
- **Verified end-to-end** against live Neon: correct login → /dashboard,
  wrong password rejected, unauthenticated routes → /login. Build passes.

### Seeded admin (change password later)
- email: `pawarninad72@gmail.com` · password: `Admin@12345` · role: admin

## Phase 3 — Done (App shell)

- **S3 client** `src/lib/s3/client.ts` — put/get/delete/list/copy/head +
  signed upload/download URLs. **Verified live** (read/write/delete OK).
- **App shell**: `(app)/layout.tsx` with `AppSidebar` (role-filtered nav),
  `Topbar` (mobile nav, theme toggle, user menu w/ sign-out), `RoleBadge`,
  dark mode (next-themes), Toaster.
- **Dashboard** — role-aware quick actions + 5 real summary cards (projects,
  images, labels, pending labels, storage) + recent projects + recent activity,
  all from live aggregate queries.
- **Projects**: list page with `ProjectsExplorer` (search, status filter,
  grid/list toggle), `ProjectCard`, `ProjectStatusBadge`.
- **Create project** (`/projects/new`, admin-only): server action inserts the
  row, writes `metadata.json` + Installer/Train Data/Annotated markers to S3,
  logs activity, rolls back the row on S3 failure. **Verified live** end-to-end
  (DB + S3 write, readback, render on /projects, detail page 200; cleaned up).
- **Project detail** `/projects/[projectId]` — access-controlled header +
  section tabs (Installer/Users/Activity gated by role). Browsers stubbed (P4).
- Data-access: `queries/{projects,members,stats,activity}.ts`; `lib/format.ts`;
  `lib/navigation.ts`. Placeholder pages for uploads/assignments/users/activity.
- Fixed a real bug found in testing: enum `IN`-list aggregate (`= any((...))`
  → `inArray`). Build green, typecheck clean, runtime smoke-tested.

---

## Phase 4 — Done (File browser)

- Data-access `queries/files.ts` — `listDirectory` (immediate folders+files,
  derives folders from file paths + explicit folders table), `getSectionFolderPaths`.
- Signed-URL actions `lib/files/actions.ts` — `getViewUrl` (thumbnails/preview,
  view perm), `getDownloadUrl` (download perm + activity log), `getLabelText`
  (label preview, 256 KB cap). All permission-checked server-side.
- Project detail refactored to **layout + tabbed routes**: Overview +
  `/train-data`, `/annotated`, `/installer` (admin) section browsers.
- Components: `SectionBrowser` (server: access check, signed thumbs, perm flags),
  `FileBrowser` (action bar, search, sort, grid/list, selection, preview),
  `FolderTree`, `FileBreadcrumbs`, `FilePreviewModal` (image nav + label text +
  metadata + download), `file-icon`.
- Mutating buttons (Upload/Create/Delete/ZIP) render per-permission but toast
  "next phase" — wired in P5/P6.
- **Verified live** with seeded demo project (`db/seed-demo.mjs`): nested
  folders render (defect_dataset → ng → crack/scratch), thumbnails load via
  signed URLs, dashboard shows 6 images. Build green, typecheck clean.

## UI/UX polish (per user feedback)

- Refined theme to a **cool-slate palette** (subtle chroma on neutrals),
  tighter `--radius` (0.5rem), colorful chart tokens.
- Typography: antialiasing, `font-feature-settings`, negative heading tracking,
  tabular numerals for data.
- Sidebar uses sidebar tokens + grouped nav + refined active state; denser
  StatCards; cleaner app background.

## Demo data

- `db/seed-demo.mjs` creates "Demo Inspection" project (6 images, 1 label).
  Remove with `node db/seed-demo.mjs --clean`.

## Phase 5 — Built (Uploads) · browser test pending CORS

- `lib/files/upload-actions.ts`:
  - `prepareUploads` — validates each file (role/section extension rules,
    non-admin executable block, per-member image override), preserves folder
    structure from `webkitRelativePath` under the destination, builds
    traversal-safe S3 keys, detects duplicates, returns signed PUT URLs.
    Conflict strategies: detect → skip / replace / rename ("keep both").
  - `confirmUploads` — after S3 PUTs succeed, inserts `files` rows
    (`onConflictDoUpdate` for replace), creates `label_uploads` for annotated
    labels, logs activity, revalidates. Re-validates server-side (defense).
- `components/upload-modal.tsx` — drag-drop + file/folder pickers
  (`webkitdirectory`), selected count/size, per-file progress (XHR), blocked
  list, duplicate prompt (Skip/Replace/Keep both), concurrency pool of 3.
- Wired into `FileBrowser` Upload buttons.
- **Verified live**: signed PUT roundtrip works (presign → PUT image/png → 200
  → HeadObject confirms). Build green, typecheck clean.
- **Pending you**: apply the bucket **CORS** policy (`docs/aws-setup.md`) so the
  browser PUT/preview are allowed; then the in-app upload is fully testable.

## Phase 6 — Done (ZIP downloads)

- `lib/zip/collect.ts` — `planZip` builds a permission-filtered entry list for
  scopes: project / section / folder / selection. Filters per section via
  `canDownloadFolder`; admin-only `metadata.json` for full project.
- `app/api/projects/[projectId]/zip/route.ts` — Node runtime, streams a ZIP via
  archiver's `ZipArchive` (note: archiver v8 dropped the callable factory —
  use `new ZipArchive()`), fetches each S3 object, preserves structure, logs
  activity. Returns 403/404/500 appropriately.
- Wired into `FileBrowser`: "Download ZIP" (folder/section) + "Download (n)"
  (selection) with Preparing/Started toasts.
- **Verified live**: section ZIP (6 images, structure preserved), full-project
  ZIP (8 files incl. label + metadata.json). Build green, typecheck clean.

## Phase 7 — Done (Users, assignments, activity)

- `lib/users/actions.ts` — admin-gated: `createUserAction`, `updateUserRoleAction`,
  `assignMemberAction` (upsert membership: role, canDownload, canUploadImages,
  paths), `removeMemberAction`. All log activity.
- **Users page** (`/users`, admin) — `UsersManager`: list w/ project counts,
  search, role filter, inline role change, add-user dialog. Can't change own role.
- **Project members** (`/projects/[id]/users`, admin) — `ProjectMemberManager`:
  assign users, toggle download / image-upload, remove.
- **Activity logs** — global `/activity` (admin) + per-project `/activity` tab,
  `ActivityLogTable`.
- **Assignments** (`/assignments`) — annotator's projects, image/label counts,
  assigned paths, open + upload-labels actions.
- **Verified live (RBAC matrix)**: created maintainer + annotator, assigned to
  demo; confirmed admin sees all, annotator denied /users (307), no installer
  tab/nav, installer ZIP 403, sees assignments; maintainer blocked from installer
  but train-data ZIP 200. UI-hide AND server-enforce both proven.

## Phase 8 — Done (Testing)

- **Vitest** unit suite — **27 tests, all passing** (`npm test`):
  - `tests/permissions.test.ts` — full role matrix (admin/maintainer/annotator),
    installer admin-only, membership gating, image-upload override, download flag.
  - `tests/validation.test.ts` — extensions, executable block + exact message,
    per-role/section allow-lists, size limit.
  - `tests/s3-keys.test.ts` — path normalization, **traversal rejection**, key
    building per section, prefixes.
- Plus extensive **live integration verification** throughout (auth loop,
  create-project S3+DB, file browser, signed PUT, ZIP scopes, RBAC).

## Test accounts (for previewing role views)

- Admin: `pawarninad72@gmail.com` / `Admin@12345`
- Maintainer: `maintainer@test.local` / `Test@12345`
- Annotator: `annotator@test.local` / `Test@12345`
  (last two assigned to the Demo Inspection project)

## Known remaining / nice-to-have

- `/uploads` global page is still a placeholder (uploads work in-browser per
  section). Folder rename + single-file delete UI not yet wired (delete via
  re-upload/replace works; bulk delete button is stubbed).
- Browser upload requires the **CORS** policy applied (see below).

## Post-launch additions

### Vercel build fix
- DB client is now **lazy** (`src/lib/db/index.ts` Proxy) — importing it no
  longer connects/throws, so `next build` page-data collection succeeds even
  with no env vars. Verified: full build passes with `.env.local` removed.
- Added `trustHost: true` to Auth.js config for Vercel.

### REST API v1 (for the desktop/EXE uploader) — see `docs/api.md`
- Bearer-token auth (JWT via `jose`, signed with `AUTH_SECRET`, 30-day).
- `POST /api/v1/auth/login`, `GET /api/v1/auth/me`
- `GET/POST /api/v1/projects`, `GET /api/v1/projects/{id}`
- `GET /api/v1/projects/{id}/files` (list), `POST` (direct multipart upload —
  bytes → S3 → DB, no CORS needed), `DELETE .../files/{fileId}`
- Same permission model enforced server-side (extracted shared
  `lib/files/upload-core.ts` `storeUploadedFile` + `effectiveAllowed`; shared
  `lib/projects/create.ts`). Proxy lets `/api/v1` through to bearer auth.
- **Verified live**: login→token, me, list projects, multipart upload (lands at
  correct S3 key), list, annotator image upload → 403, delete, no-token → 401.

## Open items / needed from user

- [x] Neon Postgres credentials (provided)
- [x] AWS S3 credentials (provided)
- [ ] **Apply S3 CORS policy** — see `docs/aws-setup.md` (needed for browser uploads/previews)
- [ ] Apply least-privilege IAM policy — see `docs/aws-setup.md`
- [ ] Rotate AWS secret + DB password if this repo is ever shared (exposed in chat)
