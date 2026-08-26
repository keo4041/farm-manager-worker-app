# Changelog

All notable changes to the **Agbelouve Farm Manager - Worker App** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## 🚨 Maintenance Policy Rule

> Every change to this codebase MUST be accompanied by an entry in `CHANGELOG.md`, as well as updates to `AGENTS.md` and `README.md`, detailing **What** changed, **Why** it was changed, and **How** it was implemented.

## [1.7.0] - 2026-08-26

### Security & Architecture Hardening
- **Public Farm Code Directory & Tenant Profile Lockdown (`firestore.rules`, `storage.rules`, `lib/tenant.ts`)**:
  - **WHAT**: Secured Firestore and Storage security rules by introducing a dedicated public collection `/farm-codes/{farmCode}` containing only `{ farmCode, tenantId, name }` for unauthenticated login resolution, locking down full tenant documents (`/tenants/{tenantId}`) to authenticated tenant members, and preventing user self-escalation to `role: 'owner'`.
  - **WHY**: Resolves Issue 3.1 where unauthenticated clients could enumerate and read all sensitive tenant metadata (owner emails, license limits, configurations). Also prevents standard workers from modifying their own user profile to gain owner/admin privileges.
  - **HOW**:
    1. Added `match /farm-codes/{code}` in `firestore.rules` allowing public read of minimal metadata (`farmCode`, `tenantId`, `name`).
    2. Restricted `match /tenants/{tenantId}` in `firestore.rules` to `isTenantMember(tenantId)`.
    3. Added strict constraint in `match /users/{userId}` update rule ensuring users cannot alter their own `role` or `tenantId`.
    4. Hardened `storage.rules` to require verified tenant membership (`userExists() && getUserData().tenantId == tenantId`) and disabled arbitrary legacy file deletion.
    5. Updated `createTenantAccount` and `lookupTenantByFarmCode` in `lib/tenant.ts` to write and read from `/farm-codes/{farmCode}`.

### Added & Enhanced
- **Automated Network Reconnection Listener & Background Media Auto-Sync (`lib/sync.ts`, `app/_layout.tsx`)**:
  - **WHAT**: Added automatic background upload trigger using `@react-native-community/netinfo` when the device regains internet connectivity.
  - **WHY**: In rural low-connectivity areas, field workers log shifts while offline; media uploads should automatically resume in the background as soon as connectivity is restored without requiring manual user intervention.
  - **HOW**:
    1. Installed `@react-native-community/netinfo`.
    2. Implemented `startNetworkSyncListener` and concurrency mutex (`isSyncProcessing`) in `lib/sync.ts`.
    3. Initialized the listener in `app/_layout.tsx` to keep the background upload queue active throughout the app lifecycle.

- **Bilingual (FR / EN) Localization System (`lib/i18n.ts`, `app/_layout.tsx`, all screens)**:
  - **WHAT**: Implemented a comprehensive French and English internationalization system with persistent storage in `AsyncStorage` (`@farm_manager_language`) and an in-header language switcher.
  - **WHY**: Field workers in Agbelouve, Togo primarily operate in French; all UI strings, buttons, error messages, and form labels must be fully localized with instantaneous switching.
  - **HOW**:
    1. Created `lib/i18n.ts` featuring comprehensive dictionaries, `useTranslation()` React hook, `getLanguage()`, and `setLanguage()`.
    2. Added a language toggle header button in `app/_layout.tsx` (🇫🇷 FR / 🇺🇸 EN).
    3. Integrated `t(...)` across `login.tsx`, `register-tenant.tsx`, `index.tsx`, `team-management.tsx`, `form-wizard.tsx`, and `sync-status.tsx`.

- **Mobile Ergonomics & Form Validation (`app/login.tsx`, `app/register-tenant.tsx`, `app/team-management.tsx`, `app/form-wizard.tsx`)**:
  - **WHAT**: Fixed keyboard occlusion issues, enforced minimum password length checks, sanitized numeric inputs, and added an in-wizard audio playback preview player.
  - **WHY**: Improves field usability, prevents input truncation on small devices, and allows workers to verify voice notes before submission.
  - **HOW**:
    1. Wrapped all forms in `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>` with `keyboardShouldPersistTaps="handled"`.
    2. Enforced minimum 6-character validation across all password input fields.
    3. Sanitized numeric inputs (`Math.max(0, parseInt(val) || 0)`) in `form-wizard.tsx`.
    4. Integrated `Audio.Sound` preview player with Play, Pause, and Delete controls in `form-wizard.tsx`.

- **Environment Variables Configuration (`.env`, `.env.example`, `lib/firebase.ts`)**:
  - **WHAT**: Decoupled Firebase project credentials to `EXPO_PUBLIC_FIREBASE_*` environment variables with fallback defaults.
  - **WHY**: Adheres to 12-factor configuration best practices and enables smooth transitions between development, staging, and production environments.

## [1.6.0] - 2026-08-25

### Added & Enhanced
- **Admin Daily & Weekly Reports Hub (`app/admin-reports.tsx`, `app/index.tsx`, `app/_layout.tsx`)**:
  - **WHAT**: Added an administrative Reports and Logs Hub allowing Owners, Admins, and Supervisors to review daily shift logs, inspect weekly rollups with aggregate KPIs, customize dashboard card views, and configure dynamic form templates.
  - **WHY**: To provide farm leadership with complete visibility into operational progress, livestock counts, attendance rates, field expenses, and media verification across morning and evening shifts.
  - **HOW**:
    1. Built `app/admin-reports.tsx` featuring a tabbed interface with:
       - **Daily Logs Tab**: Search filter, shift filter (`ALL`, `MORNING`, `EVENING`), date filter pills, customizable view modal (toggling visibility of attendance, livestock, operations, financials, media, GPS, notes), collapsible log cards, full-screen photo zoom modal, and admin delete functionality.
       - **Weekly Summary Tab**: ISO week navigation (Previous/Next week), aggregate KPI metrics (total shifts, attendance rate %, livestock population totals, total XOF expenses), and 7-day chronological shift timeline.
       - **Form Template Settings Tab**: Interactive section switches, dynamic livestock animal category editor (add/remove custom categories like Sheep, Pigs, Fish), media requirement rules, and quick-tap task checklist managers.
    2. Registered `admin-reports` in `app/_layout.tsx` and added an entry point button on the main dashboard (`app/index.tsx`) for `owner`, `admin`, and `supervisor` roles.

- **Dynamic Form Wizard & Multi-Tenant Template Customization (`app/form-wizard.tsx`, `lib/tenant.ts`)**:
  - **WHAT**: Enabled farm administrators to configure the daily log entry form template for their tenant, automatically adapting worker input fields.
  - **WHY**: Farms have diverse operational needs, varying livestock types, custom daily task routines, and differing media verification requirements.
  - **HOW**:
    1. Added `TenantFormConfig` schemas, `DEFAULT_FORM_CONFIG`, and `getTenantFormConfig` / `updateTenantFormConfig` in `lib/tenant.ts`.
    2. Updated `app/form-wizard.tsx` to dynamically fetch tenant form configuration on mount, dynamically render configured livestock categories, conditionally display sections, enforce custom photo counts, and render 1-tap checklist chips for morning and evening shifts.

## [1.5.3] - 2026-08-25

### Fixed & Enhanced
- **Worker Username Pseudo-Email RFC Compliance & Secondary Auth Provisioning (`lib/tenant.ts`)**:
  - **WHAT**: Fixed `firebase: Error (auth/invalid-email)` during worker username creation and prevented admin session sign-out during user provisioning.
  - **WHY**:
    1. Firebase Auth validates that email addresses adhere to standard RFC 5322 specs with valid ICANN public TLDs and disallows underscores (`_`) in domain names. The previous format `{username}@{tenantId}.farmapp.local` failed validation because `.local` is not an accepted public TLD and `tenantId` (e.g. `tenant_1724622...`) contained underscores in the hostname.
    2. In the Firebase Client JS SDK, calling `createUserWithEmailAndPassword` on the primary `auth` instance automatically mutates the client state to log in as the newly created user, prematurely ending the active Admin/Owner session.
  - **HOW**:
    1. Updated `buildPseudoEmail` in `lib/tenant.ts` to output RFC-compliant `{cleanUsername}.{cleanTenant}@agbelouve.app` (e.g., `koffi.tenant1724622938@agbelouve.app`).
    2. Implemented `getSecondaryAuth()` using an isolated Firebase secondary app instance (`SecondaryProvisioningApp`) to create team member accounts in the background without affecting the admin's active session.

## [1.5.2] - 2026-08-25

### Fixed & Enhanced
- **Native Expo FileSystem Binary Streaming Upload (`lib/sync.ts`)**:
  - **WHAT**: Migrated media upload pipeline to Expo FileSystem's native `createUploadTask` with `FileSystemUploadType.BINARY_CONTENT`, streaming directly to Firebase Storage REST endpoint.
  - **WHY**: In React Native, JS-based Firebase SDK methods (`uploadBytes`, `uploadBytesResumable`, `new Blob([bytes])`) trigger `"Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported"` exceptions in `BlobManager.js` and fail with `IllegalArgumentException` on `file://` local URIs in Android OkHttp.
  - **HOW**:
    1. Replaced all JS Blob conversions and Firebase SDK multipart upload methods with native `createUploadTask` binary streaming.
    2. Attached `Authorization: Firebase {idToken}` dynamically from `auth.currentUser.getIdToken()`.
    3. Streamed native progress updates (`totalBytesSent / totalBytesExpectedToSend`) to queue UI.
    4. Automatically resolved download URLs via Firebase Storage metadata.

## [1.5.1] - 2026-08-25

### Fixed & Enhanced
- **Firebase Storage Upload Protocol & Timeout Fix (`lib/sync.ts`, `lib/firebase.ts`, `storage.rules`)**:
  - **WHAT**: Resolved the `Firebase Storage: max retry time for operation exceeded (storage/retry-limit-exceeded)` error where uploads hung indefinitely.
  - **WHY**: In React Native, `uploadBytesResumable` initiates a Google Cloud Storage resumable upload session that requires reading the `X-Goog-Upload-URL` response header. Because React Native's `XMLHttpRequest` networking layer does not expose this custom header from CORS responses, Firebase Storage enters an endless retry loop that exhausts `maxUploadRetryTime`.
  - **HOW**:
    1. Switched from `uploadBytesResumable` to direct multipart `uploadBytes` in `lib/sync.ts`, completing uploads directly in a single HTTP transaction.
    2. Configured `maxUploadRetryTime` and `maxOperationRetryTime` to 30,000ms (30 seconds) in `lib/firebase.ts` to prevent indefinite blocking on network drops.
    3. Strengthened `storage.rules` with safety checks (`firestore.exists`) to avoid authorization latency and runtime rule crashes.

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
