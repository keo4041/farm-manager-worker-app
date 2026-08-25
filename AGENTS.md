# AGENTS.md - AI Agent Operational Guidelines

Welcome to the **Agbelouve Farm Manager - Worker App** repository (`worker-app`). This document provides instructions for AI agents working in this codebase, including token-saving repository structures, technical architecture details, and mandatory documentation maintenance rules.

---

## 🚨 MANDATORY RULE: 3-File Synchronization Policy

Every time an AI agent (or developer) makes a change, bug fix, feature addition, or refactoring in this repository, **YOU MUST UPDATE ALL THREE OF THE FOLLOWING DOCUMENTATION FILES**:

1. [`AGENTS.md`](file:///home/kwami/code-projects/farm-manager/worker-app/AGENTS.md)
2. [`README.md`](file:///home/kwami/code-projects/farm-manager/worker-app/README.md)
3. [`CHANGELOG.md`](file:///home/kwami/code-projects/farm-manager/worker-app/CHANGELOG.md)

### What to Document in Each File Update:
- **WHAT**: Exact description of what was added, modified, or removed.
- **WHY**: The technical or business rationale driving the change.
- **HOW**: Implementation details, affected modules, component changes, or schema updates.

---

## ⚡ Token-Saving Codebase Structure Map

To avoid executing redundant directory listings or broad text searches, refer to this structural map of the repository:

```
worker-app/
├── app/                        # Expo Router Pages & Navigation Stack
│   ├── _layout.tsx             # Root layout with header configuration & global CSS
│   ├── index.tsx               # Main Dashboard (Morning/Evening log entry, Role badge, Team button)
│   ├── login.tsx               # Worker & Owner Login (Auto-detecting email vs worker username + Farm Code)
│   ├── register-tenant.tsx     # Tenant Onboarding Wizard for Farm Owners (Auto-generates unique Farm Code)
│   ├── team-management.tsx     # Owner & Admin User Management (Supports Email and Username worker accounts)
│   ├── form-wizard.tsx         # Multi-step daily log form (GPS, attendance, livestock, media capture)
│   ├── sync-status.tsx         # Pending media upload queue & manual sync trigger
│   └── global.css              # NativeWind / Tailwind CSS entry point
├── lib/                        # Shared Utilities & Business Logic
│   ├── firebase.ts             # Firebase app, Auth persistence, Firestore local cache, Storage init
│   ├── tenant.ts               # Multi-tenant models, Farm Code auto-generator, Pseudo-email auth, RBAC, Quotas
│   └── sync.ts                 # Modern expo-file-system File API & Resumable Media Sync Queue
├── assets/                     # App icons, splash screens, and image assets
├── add-test-data.mjs           # Node script for seeding Firestore with sample daily log documents
├── firebase.json               # Firebase CLI config mapping firestore & storage security rules
├── firestore.rules             # Production security rules enforcing multi-tenant isolation & RBAC
├── storage.rules               # Production GCS security rules scoping storage by tenantId
├── app.json                    # Expo config (permissions for Camera, Audio, Location, bundle ID)
├── babel.config.js             # Babel setup with NativeWind preset
├── metro.config.js             # Metro bundler config with NativeWind CSS wrapper
├── tailwind.config.js          # Tailwind theme & color definitions (safety-yellow, etc.)
├── tsconfig.json               # TypeScript compiler config
└── package.json                # Project dependencies (Expo 55, React 19, Firebase 12, NativeWind 4)
```

---

## 🏗️ Technical Stack & Key Conventions

- **Framework**: React Native 0.83 with Expo SDK 55 & Expo Router v55.
- **Styling**: NativeWind v4 with Tailwind CSS v3 (Custom colors: `safety-yellow` `#FFCC00`).
- **Database & Auth**: Firebase JS SDK v12.
  - **Firestore Collections**:
    - `tenants`: Stores tenant profile, `farmCode` (unique collision-free code e.g. `AGBE4821`), `ownerId`, and `license` metadata (`{ planType, maxUsers, maxStorageBytes, currentUsersCount, currentStorageBytes, enforced: false }`).
    - `users`: Mapped by Auth UID containing `{ tenantId, email, username?, authMethod: 'email' | 'username', displayName, role: 'owner' | 'admin' | 'supervisor' | 'worker', createdAt }`.
    - `agbelouve-farm-daily-logs`: Scoped with `tenantId` field on every document.
  - **Auth & Centralized Route Protection**:
    - Initialized with `getReactNativePersistence(AsyncStorage)`.
    - **Centralized Auth Guard (`app/_layout.tsx`)**: Listens to Firebase `onAuthStateChanged` and route segments (`useSegments()`). Automatically intercepts unauthenticated access to protected routes (`/`, `/form-wizard`, `/sync-status`, `/team-management`) and redirects to `/login`. Automatically routes authenticated users away from `/login` and `/register-tenant` back to `/`. Displays a branded splash spinner during session restoration.
    - **Session Logout & Farm Code Badge (`app/index.tsx`)**: Provides native `signOut(auth)` action with confirmation dialog and prominent Farm Code display.
  - **Worker Pseudo-Email Auth & Secondary Provisioning**:
    - Farm workers without standard email log in with their **Username + Farm Code + Password**.
    - Farm Code is looked up against `tenants.farmCode` to obtain `tenantId`.
    - The client deterministically computes RFC-compliant `{cleanUsername}.{cleanTenant}@agbelouve.app` (using standard ICANN `.app` TLD and alphanumeric labels without underscores) and authenticates via standard Firebase Auth.
    - Owner/Admin team member creation uses an isolated secondary Firebase app instance (`SecondaryProvisioningApp`) so user provisioning never logs out the active admin session.
- **Offline Sync Queue & Firebase Storage Uploads**:
  - `lib/sync.ts` stores pending media uploads in `AsyncStorage` under `@farm_manager_sync_queue`.
  - **Native Binary Streaming (`createUploadTask` with `BINARY_CONTENT`)**: Uses Expo FileSystem's native `createUploadTask` to stream local `file://` URIs directly to the Firebase Cloud Storage REST endpoint (`https://firebasestorage.googleapis.com/v0/b/{bucket}/o?name={path}`).
  - **Zero Bridge / Zero Blob Overhead**: Bypasses React Native's `BlobManager` and JavaScript memory altogether, permanently preventing `"Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported"` errors and memory bloat.
  - **Real-Time Progress**: Automatically computes real-time upload percentage (`totalBytesSent / totalBytesExpectedToSend`) from native progress callbacks.
  - **Authenticated Uploads**: Attaches `Authorization: Firebase {idToken}` dynamically from `auth.currentUser.getIdToken()`.
  - Media item schema (`PendingMedia`): `id`, `logId`, `tenantId`, `localUri`, `type` (`photo`|`video`|`voice`), `fileName`, `status` (`pending`|`uploading`|`completed`|`failed`), `progress` (0-100), `retryCount`, `errorMessage`, `createdAt`.
  - Storage paths: `tenants/{tenantId}/logs/{logId}/{fileName}`.

- **Hardware Integration**:
  - `expo-location`: High-accuracy GPS tagging for log submissions.
  - `expo-camera` / `expo-image-picker`: Photo and video capture (minimum 2 photos required for submission).
  - `expo-av`: Audio recording for voice notes.

---

## 📋 Standard Workflow for Modifications

1. **Inspect Target Files**: Read existing code using line ranges to minimize token consumption.
2. **Implement Changes**: Ensure TypeScript types and components maintain offline compatibility.
3. **Verify**: Ensure code compiles without broken imports or missing properties (`npx tsc --noEmit`).
4. **Update Documentation**: Always update `AGENTS.md`, `README.md`, and `CHANGELOG.md` with the **What, Why, and How**.
