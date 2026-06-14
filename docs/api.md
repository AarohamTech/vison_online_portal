# Vision Dataset Manager — REST API (v1)

Token-authenticated REST API for external clients (e.g. the desktop uploader).
Base URL: `https://YOUR-VERCEL-DOMAIN` (or `http://localhost:3000` in dev).

All responses are JSON. Errors look like:
```json
{ "error": { "code": "forbidden", "message": "..." } }
```

## Authentication

Authenticate once with email + password to get a **bearer token** (JWT, valid
30 days). Send it on every other request as `Authorization: Bearer <token>`.

### POST `/api/v1/auth/login`
```json
{ "email": "user@example.com", "password": "secret" }
```
→ `200`
```json
{
  "token": "eyJ...",
  "tokenType": "Bearer",
  "expiresInDays": 30,
  "user": { "id": "...", "email": "...", "fullName": "...", "role": "admin" }
}
```
→ `401` on bad credentials.

### GET `/api/v1/auth/me`
Header: `Authorization: Bearer <token>` → `{ "user": { id, email, name, role } }`

## Projects

### GET `/api/v1/projects`
Projects the caller can access → `{ "projects": [ { id, name, customerName, productName, status, totalImages, totalLabels, ... } ] }`

### POST `/api/v1/projects`  (admin only)
```json
{ "name": "Line A", "customerName": "Acme", "productName": "Cap-200", "status": "active" }
```
→ `201 { "project": { ... } }` · auto-provisions the S3 folder structure + metadata.json.

### GET `/api/v1/projects/{projectId}`
→ `{ "project": { ... } }`

## Files

### GET `/api/v1/projects/{projectId}/files?section=train_data&path=foo/bar`
`section` = `train_data` | `annotated` | `installer` (default `train_data`).
→ `{ section, path, folders: [{name, path}], files: [{ id, fileName, fileType, size, folderPath, createdAt }] }`

### POST `/api/v1/projects/{projectId}/files`  (multipart/form-data)
The main upload endpoint — send raw bytes, the server stores them in S3 and
records the file. No S3 credentials or CORS needed on the client.

Form fields:
| field | required | notes |
|-------|----------|-------|
| `file` | yes | the file bytes |
| `section` | no | `train_data` (default) / `annotated` / `installer` |
| `path` | no | destination subfolder, e.g. `batch_2024/ok` |
| `relPath` | no | relative path to preserve folder structure (defaults to file name) |

→ `201 { "file": { id, fileName, fileType, size, section, folderPath, objectKey, createdAt } }`
→ `403` if the role/section/extension is not allowed (e.g. annotator uploading an image, or executables for non-admins).

Example (curl):
```bash
curl -X POST "$BASE/api/v1/projects/$PID/files" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@image.png" -F "section=train_data" -F "path=batch_1"
```

### DELETE `/api/v1/projects/{projectId}/files/{fileId}`
Soft-deletes the record and removes the object from S3.
→ `{ "ok": true, "deleted": "<fileId>" }`

## Permission model (enforced server-side)

- **Admin** — full access to all projects/sections.
- **Maintainer** — assigned projects; upload/delete images + labels in
  train_data / annotated; **no** installer access.
- **Annotator** — assigned projects; upload **labels only** (images only if the
  admin enabled `canUploadImages`); no delete; no installer.

Executable/installer files (`.exe .msi .bat .sh .dll …`) are rejected for
non-admins on every endpoint.

## Notes for the desktop uploader

1. Call `/auth/login` once, store the token (valid 30 days).
2. Call `/projects` to let the user pick a target project.
3. For each image, POST to `/projects/{id}/files` with `section=train_data`
   (and optional `path`/`relPath` to preserve folders).
4. Re-login when a request returns `401` (token expired).
