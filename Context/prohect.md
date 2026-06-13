Build a modern Next.js web application for managing image datasets for vision inspection projects.

The app is a secure internal dataset management platform. It does NOT need annotation tools. Annotators will only upload label files for images. The app should manage projects, folders, image data, installers, labels, and user permissions.

Tech stack:

* Next.js App Router
* TypeScript
* Tailwind CSS
* shadcn/ui components
* Supabase for database and authentication
* S3-compatible object storage for all files
* Use clean, scalable, production-ready architecture
* Use responsive UI for desktop-first usage, but should work on tablets too

Core purpose:
Our team works on vision inspection projects and handles large image datasets. Each project/customer/product has a fixed folder structure. Users should be able to upload folders or multiple files, browse images, manage labels, and download image datasets as ZIP files depending on their role.

Main folder structure:

Project / Customer / Product
│
├── Installer/
│   ├── v1.0/
│   ├── v1.1/
│   └── release_notes.txt
│
├── Train Data/
│   └── raw/
│
├── Annotated/
│   └── final_labels/
│
└── metadata.json

Important:
Admin can create additional subfolders under Installer, Train Data, and Annotated.
Maintainer can manage image data but must NOT be able to manage or delete installer/exe files.
Annotator can only view assigned training image data and upload label files. Annotator must NOT see the Installer section.

User roles:

1. Admin

* Full access to everything
* Can create, update, delete projects
* Can create, rename, delete folders and subfolders
* Can upload, delete, move, and download all files
* Can upload installers and executable files
* Can manage users and assign roles
* Can assign users to projects
* Can see Installer, Train Data, Annotated, metadata, and all project settings
* Can download complete project ZIP
* Can download folder ZIP
* Can delete images, labels, installers, folders, and projects
* Can edit metadata.json
* Can view audit logs

2. Maintainer

* Can view assigned projects
* Can upload image files or folders into Train Data/raw and other allowed image folders
* Can update/delete images
* Can create image-related subfolders inside Train Data and Annotated if allowed
* Can download images as ZIP
* Can upload label files into Annotated/final_labels if needed
* Can NOT view, upload, update, download, or delete Installer files
* Can NOT upload exe, msi, bat, sh, dll, or installer-related files
* Can NOT delete projects
* Can NOT manage users
* Can NOT edit admin-only metadata
* Can view project metadata but not sensitive admin settings

3. Annotator

* Can view only assigned projects or assigned folders
* Can view image data from Train Data/raw
* Can preview images
* Can upload label files only into Annotated/final_labels or assigned label folder
* Can upload labels such as .txt, .json, .xml, .csv depending on project settings
* Can NOT upload images unless explicitly allowed by admin
* Can NOT delete images
* Can NOT delete folders
* Can NOT see Installer section at all
* Can NOT download installers
* Can NOT manage users
* Can NOT delete projects
* Can download only allowed image data if permission is enabled
* Can see upload status of their own labels

Authentication:

* Use Supabase Auth
* Login page with email/password
* After login, redirect based on user role
* Store user profile in Supabase table with role: admin, maintainer, annotator
* Use Row Level Security conceptually
* UI must hide actions not allowed for user role
* Backend/server actions must also validate role permissions, not only frontend hiding

Main pages:

1. Login Page

* Clean centered login card
* App name: Vision Dataset Manager
* Email and password fields
* Login button
* Error state
* Loading state

2. Dashboard Page

* Summary cards:

  * Total Projects
  * Total Images
  * Total Labels
  * Pending Label Uploads
  * Storage Used
* Recent activity panel
* Recent projects table
* Quick action buttons based on role:

  * Admin: Create Project, Manage Users
  * Maintainer: Upload Data
  * Annotator: My Assigned Data

3. Projects Page

* List all accessible projects
* Search by project/customer/product
* Filter by status
* Project cards or table view
* Each project should show:

  * Project name
  * Customer name
  * Product name
  * Total images
  * Total labels
  * Last updated
  * Status
* Admin can create/edit/delete project
* Maintainer and Annotator only see assigned projects

4. Project Detail Page
   Layout:

* Header with project name, customer, product, status
* Breadcrumb navigation
* Tabs:

  * Overview
  * Files
  * Train Data
  * Annotated
  * Installer only visible to Admin
  * Users visible to Admin
  * Activity Logs visible to Admin

5. File Browser Page / Component
   Build a file manager-like interface.

Features:

* Breadcrumb path navigation
* Folder tree sidebar
* Main file grid/table
* Toggle grid/list view
* Search files
* Filter by file type
* Sort by name, size, uploaded date, uploaded by
* File/folder icons
* Image thumbnails
* File size display
* Upload progress bar
* Drag-and-drop upload
* Folder upload using webkitdirectory support
* Multiple file upload
* Create folder button for Admin and allowed Maintainer
* Rename folder/file if permitted
* Delete folder/file if permitted
* Download individual file
* Download selected files as ZIP
* Download current folder as ZIP
* Download all images in current project as ZIP if permitted
* Selection checkboxes for bulk actions

Folder Upload Behavior:
When user uploads a folder, preserve the folder structure.
Example:
User uploads folder:
defect_dataset/
ok/
img1.jpg
ng/
crack/
img2.jpg

It should be placed inside the selected destination path:
projects/{projectId}/train-data/raw/defect_dataset/ok/img1.jpg
projects/{projectId}/train-data/raw/defect_dataset/ng/crack/img2.jpg

For annotator label upload:
If annotator uploads labels, place them inside:
projects/{projectId}/annotated/final_labels/{userId}/

If labels are uploaded for a specific image folder, preserve relative structure:
projects/{projectId}/annotated/final_labels/{userId}/same-relative-path/

File type rules:
Allowed image files:

* .jpg
* .jpeg
* .png
* .bmp
* .tif
* .tiff
* .webp

Allowed label files:

* .txt
* .json
* .xml
* .csv
* .yaml
* .yml

Allowed installer files only for Admin:

* .exe
* .msi
* .zip
* .7z
* .rar
* .dll
* .bat
* .sh
* .txt
* .md
* release notes

Maintainer restrictions:

* Maintainer must not be able to upload or delete installer files
* Maintainer must not even see Installer tab
* Maintainer should be blocked from uploading .exe, .msi, .bat, .sh, .dll files
* If attempted, show error: “You do not have permission to upload installer or executable files.”

Annotator restrictions:

* Annotator must not see Installer tab
* Annotator must not see user management
* Annotator must not delete images
* Annotator can only upload label files
* Annotator cannot upload executable files
* Annotator cannot create top-level folders
* Annotator can only access assigned projects/folders

ZIP download:
Implement ZIP download feature conceptually.
User should be able to:

* Download selected images as ZIP
* Download current folder as ZIP
* Download all raw train data as ZIP if permission allows
* Download final labels as ZIP
* Admin can download complete project ZIP including Installer, Train Data, Annotated, metadata
* Maintainer can download Train Data and Annotated only, excluding Installer
* Annotator can download only assigned image data and their accessible labels

ZIP generation behavior:

* Use server-side API route or server action
* Fetch files from S3-compatible storage
* Stream ZIP response to browser
* Preserve folder structure inside ZIP
* Show loading state while preparing ZIP
* Use toast notifications:

  * Preparing ZIP...
  * Download started
  * Failed to prepare ZIP

S3 object key structure:
Use this object key format:

projects/{projectId}/installer/{versionOrSubfolder}/{filename}
projects/{projectId}/train-data/raw/{optionalSubfolder}/{filename}
projects/{projectId}/annotated/final_labels/{userId}/{optionalSubfolder}/{filename}
projects/{projectId}/metadata.json

Database schema suggestion:

profiles

* id uuid primary key references auth.users
* email text
* full_name text
* role text check in admin, maintainer, annotator
* created_at timestamp
* updated_at timestamp

projects

* id uuid primary key
* name text
* customer_name text
* product_name text
* description text
* status text
* created_by uuid
* created_at timestamp
* updated_at timestamp

project_members

* id uuid primary key
* project_id uuid references projects
* user_id uuid references profiles
* role text
* can_download boolean default true
* assigned_paths text[]
* created_at timestamp

files

* id uuid primary key
* project_id uuid references projects
* bucket text
* object_key text
* file_name text
* file_type text
* mime_type text
* size bigint
* section text check in installer, train_data, annotated, metadata
* folder_path text
* uploaded_by uuid references profiles
* assigned_to uuid nullable references profiles
* created_at timestamp
* updated_at timestamp
* deleted_at timestamp nullable

folders

* id uuid primary key
* project_id uuid references projects
* name text
* path text
* section text check in installer, train_data, annotated
* parent_path text nullable
* created_by uuid
* created_at timestamp
* updated_at timestamp

label_uploads

* id uuid primary key
* project_id uuid references projects
* image_file_id uuid nullable references files
* label_file_id uuid references files
* uploaded_by uuid references profiles
* status text check in uploaded, reviewed, rejected
* created_at timestamp
* reviewed_by uuid nullable
* reviewed_at timestamp nullable

activity_logs

* id uuid primary key
* project_id uuid nullable
* user_id uuid references profiles
* action text
* target_type text
* target_id text
* details jsonb
* created_at timestamp

Permissions logic:
Create a centralized permission helper:
canViewInstaller(user)
canManageInstaller(user)
canUploadImages(user, project)
canDeleteImages(user, project)
canUploadLabels(user, project)
canCreateFolder(user, section)
canDeleteFolder(user, section)
canDownloadFolder(user, section)
canManageUsers(user)

Permission rules:

* Admin returns true for all permissions
* Maintainer can manage train_data and annotated image/label areas only
* Maintainer cannot access installer
* Annotator can view train_data only if assigned
* Annotator can upload labels only
* Annotator cannot access installer
* Annotator cannot delete files or folders

UI/UX requirements:
Use a clean professional dashboard style.
Design should feel like a modern internal developer/data platform.

Visual style:

* Light theme by default
* Optional dark mode toggle
* Sidebar navigation
* Top bar with user profile and role badge
* Breadcrumbs for folders
* Cards with subtle borders and shadows
* shadcn/ui components
* Use icons from lucide-react
* Use clean spacing and readable typography
* Use status badges
* Use role badges:

  * Admin
  * Maintainer
  * Annotator

Sidebar navigation:

* Dashboard
* Projects
* Uploads
* My Assignments
* Users only for Admin
* Activity Logs only for Admin
* Settings

Project detail UI:

* Left folder tree
* Right file browser
* Top action bar:

  * Upload Files
  * Upload Folder
  * Create Folder
  * Download ZIP
  * Delete Selected
  * Refresh
    Actions should appear/disable based on permissions.

File preview:

* Image preview modal
* Show filename, size, path, uploaded by, uploaded date
* Next/previous image navigation
* Download button if permitted
* For label files, show text preview if possible
* For unsupported files, show metadata only

Upload modal:

* Select destination:

  * Train Data/raw
  * Annotated/final_labels
  * Installer only Admin
* Drag and drop area
* File picker
* Folder picker
* Show selected files count
* Show total size
* Show detected blocked files
* Show upload progress per file
* Show completed/failed states
* Preserve folder structure
* Validate role permissions before upload
* Validate file types before upload

Create project modal:
Fields:

* Project name
* Customer name
* Product name
* Description
* Status
* Initial folder structure should be automatically created:

  * Installer
  * Train Data/raw
  * Annotated/final_labels
* Automatically create metadata.json with basic project info

Metadata:
metadata.json should include:
{
"projectId": "",
"projectName": "",
"customerName": "",
"productName": "",
"createdAt": "",
"updatedAt": "",
"createdBy": "",
"folderStructureVersion": "1.0"
}

Users management page:
Admin only.
Features:

* List users
* Search users
* Filter by role
* Change role
* Assign users to projects
* Set project-specific access
* For annotators, assign specific paths/folders
* Toggle download permission
* Remove user from project

My Assignments page:
For annotators.
Show:

* Assigned projects
* Assigned folders
* Number of images
* Number of labels uploaded by me
* Upload labels button
* Open folder button

Activity logs:
Track:

* Project created
* Project updated
* File uploaded
* Folder uploaded
* File deleted
* Folder created
* Folder deleted
* ZIP downloaded
* Label uploaded
* User assigned
* Role changed

Important UX details:

* Never show actions that user is not allowed to perform
* Also validate permissions server-side
* Show helpful empty states
* Show confirmation dialogs for delete actions
* For dangerous actions, require typed confirmation for Admin project delete
* Use toast notifications for success/error
* Use skeleton loaders
* Use optimistic UI where safe
* Use pagination or infinite scroll for large file lists
* Image-heavy folders should lazy load thumbnails
* Do not load all full-size images at once
* Use signed URLs for image previews
* Cache thumbnails where possible conceptually

Pages/routes suggestion:

* /login
* /dashboard
* /projects
* /projects/new
* /projects/[projectId]
* /projects/[projectId]/files
* /projects/[projectId]/train-data
* /projects/[projectId]/annotated
* /projects/[projectId]/installer
* /projects/[projectId]/users
* /assignments
* /uploads
* /users
* /activity
* /settings

Components to create:

* AppSidebar
* Topbar
* RoleBadge
* ProjectCard
* ProjectTable
* FileBrowser
* FolderTree
* FileGrid
* FileTable
* FilePreviewModal
* UploadModal
* CreateFolderDialog
* DeleteConfirmDialog
* ZipDownloadButton
* UserRoleSelect
* ProjectMemberManager
* ActivityLogTable
* EmptyState
* PermissionGuard

API/server actions needed conceptually:

* createProject
* updateProject
* deleteProject
* createFolder
* renameFolder
* deleteFolder
* listFiles
* uploadFiles
* uploadFolder
* deleteFile
* downloadFile
* generateZip
* createSignedUploadUrl
* createSignedDownloadUrl
* assignUserToProject
* updateUserRole
* uploadLabelFile
* getActivityLogs

Do not implement annotation canvas or drawing tools.
The app only manages uploaded labels.

Important implementation detail:
For folder uploads in browser, use input with:
webkitdirectory
multiple

Use each file's webkitRelativePath to preserve folder structure.

For S3 uploads:

* Generate signed upload URL from backend
* Upload directly from browser to S3
* After successful upload, save file metadata in Supabase files table
* If upload fails, do not create DB record
* If DB save fails after upload, show warning and log cleanup requirement

Security:

* Do not expose S3 secret keys on frontend
* All signed URLs must be generated server-side
* Validate file extension and MIME type
* Validate project access server-side
* Validate role server-side
* Prevent path traversal
* Normalize folder paths
* Avoid allowing users to overwrite files accidentally
* If duplicate filename exists, ask user whether to:

  * Skip
  * Replace
  * Keep both with renamed suffix

Dashboard details:
Admin dashboard:

* All projects
* Storage usage
* Recent uploads
* User activity
* Installer updates
* Labels uploaded

Maintainer dashboard:

* Assigned projects
* Recent train data uploads
* Data folders
* Download train data
* Upload images

Annotator dashboard:

* My assigned projects
* My assigned folders
* Upload labels
* My recent label uploads

Desired final output from v0:
Generate the full UI with mock data and clean component structure.
Use placeholder server actions where needed.
Make the UI realistic and production-ready.
Include role-based conditional rendering.
Use mock current user role switcher during development so I can preview Admin, Maintainer, and Annotator views.
Do not connect real Supabase or S3 yet, but structure the code so it can be connected later.
Use TypeScript interfaces for User, Project, FileItem, FolderItem, ProjectMember, ActivityLog.
Create reusable components.
Make it polished and ready for further backend integration.
