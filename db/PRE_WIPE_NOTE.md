# Pre-wipe note — 2026-06-13

Before initializing the Vision Dataset Manager schema, the Neon `public`
schema contained tables from a prior scaffolded project. **All were empty
(0 rows).** They were dropped via `DROP SCHEMA public CASCADE` with the user's
explicit approval (no data lost).

Dropped tables (all 0 rows):
- account, session, user, verification  (Better Auth scaffolding)
- projects, project_members, files, folders, label_uploads, activity_logs
  (prior, text-id/no-enum schema — superseded by our Drizzle schema)
