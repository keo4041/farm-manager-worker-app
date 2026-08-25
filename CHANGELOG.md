# Changelog

All notable changes to the **Agbelouve Farm Manager - Worker App** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## 🚨 Maintenance Policy Rule

> Every change to this codebase MUST be accompanied by an entry in `CHANGELOG.md`, as well as updates to `AGENTS.md` and `README.md`, detailing **What** changed, **Why** it was changed, and **How** it was implemented.

## [1.5.0] - 2026-08-25

### Added & Enhanced
- **Centralized Auth Guards & Session Protection (`app/_layout.tsx`, `app/index.tsx`)**:
  - **WHAT**: Implemented automatic route protection ensuring unauthenticated users are directed to the login/signup screens (`/login` or `/register-tenant`), while authenticated users are directed to the home dashboard (`/`). Added native Sign Out functionality and Farm Code display on the dashboard.
  - **WHY**: To prevent unauthenticated users from accessing protected views (`/`, `/form-wizard`, `/sync-status`, `/team-management`) and ensure consistent session lifecycle management across the app.
  - **HOW**: 
    1. Added `onAuthStateChanged` and `useSegments()` listeners in `app/_layout.tsx` to guard all protected routes and redirect unauthenticated users to `/login`.
    2. Implemented a branded loading screen during initial session restoration to prevent UI layout flashes.
    3. Added reactive auth listener, Farm Code badge, and a "Log Out / Déconnexion" button with confirmation alert in `app/index.tsx`.

## [1.4.1] - 2026-08-25

### Fixed & Enhanced
- **React Native Firebase Storage Upload Pipeline & Blob Fix (`lib/sync.ts`)**:
  - **WHAT**: Fixed the runtime exception `"Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported"` encountered during media uploads to Firebase Cloud Storage.
  - **WHY**: In React Native, JavaScript engines (such as Hermes) and `BlobManager` do not support constructing Blobs from `ArrayBuffer` or `ArrayBufferView` (`Uint8Array`) using `new Blob([bytes])`. Passing files via `fetch(uri)` on local URIs is also unreliable on mobile devices.
  - **HOW**: 
    1. Replaced `getBlobFromUri` with `getUploadDataFromUri` utilizing native `XMLHttpRequest` with `responseType = 'blob'`, which interfaces directly with React Native's native `BlobModule`.
    2. Added fallback to `fetch` (for Web) and direct `Uint8Array` binary bytes passing directly to `uploadBytesResumable` without wrapping in `new Blob`.
    3. Added `getContentType` helper to pass explicit MIME metadata (`image/jpeg`, `video/mp4`, `audio/m4a`, etc.) with uploads.
    4. Added automatic memory reclamation via `blob.close()` in `finally` blocks to prevent memory leaks during large media batch uploads.

## [1.4.0] - 2026-08-25

### Added & Enhanced
- **Collision-Free Unique Farm Code Generation & Lookup (`lib/tenant.ts`, `app/register-tenant.tsx`)**:
  - **WHAT**: Implemented automatic collision-free unique Farm Code generation (`generateUniqueFarmCode`) with prefix parsing (e.g. `AGBE4821`), uniqueness verification against Firestore `tenants` collection, and Farm Code lookup (`lookupTenantByFarmCode`).
  - **WHY**: To provide a simple, human-readable code that farm workers can enter to identify their organization without needing complex UUIDs or exposing other tenant names.
  - **HOW**: Added `farmCode` to `Tenant` model, integrated verification loop in `createTenantAccount`, and displayed the generated code prominently in the registration wizard and Team Management header.
- **Worker Username Authentication & Pseudo-Email Engine (`lib/tenant.ts`, `app/login.tsx`)**:
  - **WHAT**: Added support for non-email farm workers to log in with **Username + Farm Code + Password**. Added `username` and `authMethod: 'email' | 'username'` to `UserProfile`.
  - **WHY**: To accommodate field farm workers who do not have corporate or personal email addresses, allowing them to participate in shift logging while retaining Firebase Authentication under the hood.
  - **HOW**: Created `buildPseudoEmail(username, tenantId)` mapping usernames to `{username}@{tenantId}.farmapp.local`, and upgraded `app/login.tsx` to automatically detect email vs username inputs and conditionally render the Farm Code input.
- **Team Management Dual-Mode User Provisioning (`app/team-management.tsx`)**:
  - **WHAT**: Updated the "Add Team Member" modal with an **Account Type Switcher** allowing admins to create either standard Email accounts or Username-based worker accounts.
  - **WHY**: To allow farm owners and admins to seamlessly provision workers on-site without asking for emails.
  - **HOW**: Added `authMethod` state toggle, updated `addUserToTenant` to accept username parameters, and added `[USERNAME: name]` badges in the team list.
- **Modern `expo-file-system` Migration (`lib/sync.ts`)**:
  - **WHAT**: Migrated `lib/sync.ts` from deprecated string-based functions (`getInfoAsync`, `readAsStringAsync`) to the modern SDK 54+ `File` class (`new File(uri).exists`, `await file.bytes()`).
  - **WHY**: To prevent deprecation warnings, avoid memory spikes from large Base64 conversions, and leverage Expo's native SharedObjects architecture.
  - **HOW**: Replaced `FileSystem.getInfoAsync` with `new File(uri).exists` and updated `getBlobFromUri` to directly convert binary `Uint8Array` to `Blob`.
- **Firestore Security Rules Resolution (`firestore.rules`)**:
  - **WHAT**: Updated `tenants` collection read rule to allow unauthenticated read during Farm Code lookup at login.
  - **WHY**: To allow workers to resolve their Farm Code to `tenantId` prior to authenticating.
  - **HOW**: Adjusted `allow read: if isTenantMember(tenantId) || resource.data.farmCode != null;`.

---

## [1.3.0] - 2026-08-25

### Added
- **Firebase Firestore Security Rules ([`firestore.rules`](file:///home/kwami/code-projects/farm-manager/worker-app/firestore.rules))**:
  - **WHAT**: Created production-grade security rules for Firestore database collections (`tenants`, `users`, `agbelouve-farm-daily-logs`).
  - **WHY**: To enforce tenant isolation and role-based access control (RBAC), ensuring users can only read/write documents belonging to their active `tenantId`, and restricting user management to Owners/Admins.
  - **HOW**: Implemented Firestore rules helpers (`getUserData()`, `isTenantMember()`, `isOwnerOrAdmin()`).
- **Firebase Cloud Storage Security Rules ([`storage.rules`](file:///home/kwami/code-projects/farm-manager/worker-app/storage.rules))**:
  - **WHAT**: Created Cloud Storage security rules for path `tenants/{tenantId}/logs/{logId}/{fileName}` and legacy fallback `logs/{logId}/{fileName}`.
  - **WHY**: To secure photo, video, and voice note media attachments by tenant boundary.
  - **HOW**: Cross-checked storage path `{tenantId}` against authenticated user's Firestore profile `tenantId`.
- **Firebase CLI Project Manifest ([`firebase.json`](file:///home/kwami/code-projects/farm-manager/worker-app/firebase.json))**:
  - **WHAT**: Added `firebase.json` mapping Firestore and Storage security rules files for deployment via `firebase deploy --only firestore:rules,storage`.

---

## [1.2.0] - 2026-08-25

### Added & Enhanced
- **Multi-Tenant Data Architecture & Licensing Hooks (`lib/tenant.ts`, `lib/sync.ts`)**:
  - **WHAT**: Implemented multi-tenant data model with `tenants` and `users` collections in Firestore, tenant-isolated GCS storage paths (`tenants/{tenantId}/logs/{logId}/{fileName}`), user role types (`owner`, `admin`, `supervisor`, `worker`), and modular licensing quota check hooks (`checkLicenseQuota`).
  - **WHY**: To transform the app into a multi-tenant platform where separate farm organizations can securely isolate their logs, users, and media assets, while preparing for future tier-based user and storage volume limits.
  - **HOW**: Created `lib/tenant.ts` with `createTenantAccount`, `addUserToTenant`, `getUserProfile`, `getTenantDetails`, and `checkLicenseQuota` functions. Updated `lib/sync.ts` and `app/form-wizard.tsx` to pass `tenantId`.
- **Tenant Registration Wizard (`app/register-tenant.tsx`)**:
  - **WHAT**: Built an onboarding wizard for farm owners to create a tenant organization and optionally pre-add initial team members (Admins, Supervisors, Workers) during registration.
  - **WHY**: To allow farm owners to seamlessly register their farm and set up their operational staff in one guided process.
  - **HOW**: Created `app/register-tenant.tsx` form connected to `createTenantAccount()` and added link from `app/login.tsx`.
- **In-App Team Management & Quotas Screen (`app/team-management.tsx`)**:
  - **WHAT**: Built a team management dashboard for Owners and Admins to inspect tenant team members, add new users post-registration, assign roles, and review storage/user quota usage metrics.
  - **WHY**: To enable ongoing team user provisioning and role assignment directly inside the mobile app.
  - **HOW**: Created `app/team-management.tsx` with user list, role badges, and an add-user modal.
- **Role-Adaptive Dashboard & Navigation (`app/index.tsx`, `app/form-wizard.tsx`, `app/_layout.tsx`)**:
  - **WHAT**: Updated home dashboard header to show active Tenant Name and User Role Badge (`[OWNER]`, `[ADMIN]`, `[SUPERVISOR]`, `[WORKER]`), rendering team management buttons conditionally for management roles.
  - **WHY**: To tailor the user experience to the permissions and responsibilities of each user role.
  - **HOW**: Refactored `app/index.tsx` to fetch user profile, updated `app/form-wizard.tsx` to include `tenantId`, and registered new routes in `app/_layout.tsx`.

---

## [1.1.0] - 2026-08-25

### Added & Enhanced
- **Media Upload Engine & Queue Resilience (`lib/sync.ts`)**:
  - **WHAT**: Upgraded `processSyncQueue` with real-time percentage progress streaming (`uploadBytesResumable`), cross-platform URI to Blob conversion (with Expo FileSystem Base64 fallback), and detailed item status metrics (`pending`, `uploading`, `completed`, `failed`).
  - **WHY**: To prevent network timeouts and silent upload failures while providing transparent feedback and auto-retry capabilities for delayed uploads when offline.
  - **HOW**: Updated `PendingMedia` interface in `lib/sync.ts`, added `saveQueue`, `updateItemInQueue`, `retryFailedItems`, and `clearCompletedItems` helpers, and hooked `uploadBytesResumable` state listeners to progress callbacks.
- **Upload Progress UI Modal (`app/form-wizard.tsx`)**:
  - **WHAT**: Added a step-by-step upload progress modal that overlays when submitting daily logs.
  - **WHY**: To inform farm workers in real-time of photo/video/voice upload status when connected, or notify them when saved locally for delayed sync.
  - **HOW**: Integrated progress modal component with percentage state, overall item counter, and conditional offline alert.
- **Queue Inspector UI & Dashboard Integration (`app/sync-status.tsx`, `app/index.tsx`)**:
  - **WHAT**: Enhanced queue listing screen with visual status badges, progress bars, per-item removal/retry buttons, and added a live pending count badge on the home screen.
  - **WHY**: To give workers full visibility and control over pending offline media uploads.
  - **HOW**: Refactored `sync-status.tsx` list items and added background queue polling in `index.tsx`.

---

## [1.0.0] - 2026-08-25

### Added
- **Documentation & Agent Configuration**:
  - Created [`AGENTS.md`](file:///home/kwami/code-projects/farm-manager/worker-app/AGENTS.md) containing repository navigation maps for token optimization, technical stack rules, and mandatory 3-file maintenance policies.
  - Created [`README.md`](file:///home/kwami/code-projects/farm-manager/worker-app/README.md) featuring a system architecture diagram (Mermaid), key feature overview, directory breakdown, and installation guides.
  - Created [`CHANGELOG.md`](file:///home/kwami/code-projects/farm-manager/worker-app/CHANGELOG.md) for versioned tracking.
  - Added [`.agentignore`](file:///home/kwami/code-projects/farm-manager/worker-app/.agentignore) to optimize AI agent context window tokens by ignoring build artifacts, caches, and dependency locks.
- **Core Mobile Application**:
  - Expo Router layout stack navigation with styled header ([`app/_layout.tsx`](file:///home/kwami/code-projects/farm-manager/worker-app/app/_layout.tsx)).
  - Main worker landing page supporting Morning & Evening shift log creation ([`app/index.tsx`](file:///home/kwami/code-projects/farm-manager/worker-app/app/index.tsx)).
  - Firebase email/password authentication screen ([`app/login.tsx`](file:///home/kwami/code-projects/farm-manager/worker-app/app/login.tsx)).
  - Guided daily log wizard with GPS coordinate tagging, worker attendance tracking, livestock counts, and camera/voice note recordings ([`app/form-wizard.tsx`](file:///home/kwami/code-projects/farm-manager/worker-app/app/form-wizard.tsx)).
  - Sync queue dashboard to process and monitor pending offline media uploads ([`app/sync-status.tsx`](file:///home/kwami/code-projects/farm-manager/worker-app/app/sync-status.tsx)).
- **Backend & Offline Services**:
  - Firebase integration with `persistentLocalCache()` for offline Firestore access and `AsyncStorage` auth persistence ([`lib/firebase.ts`](file:///home/kwami/code-projects/farm-manager/worker-app/lib/firebase.ts)).
  - Offline media upload queue processor storing pending media items in `AsyncStorage` key `@farm_manager_sync_queue` ([`lib/sync.ts`](file:///home/kwami/code-projects/farm-manager/worker-app/lib/sync.ts)).
  - Firestore seeding script for generating sample daily log records ([`add-test-data.mjs`](file:///home/kwami/code-projects/farm-manager/worker-app/add-test-data.mjs)).
