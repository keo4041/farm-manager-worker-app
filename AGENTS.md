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
│   ├── login.tsx               # Worker Authentication screen & Register Tenant link
│   ├── register-tenant.tsx     # Tenant Onboarding Wizard for Farm Owners & initial team setup
│   ├── team-management.tsx     # Owner & Admin User/Role Management & License Quotas Inspector
│   ├── form-wizard.tsx         # Multi-step daily log form (GPS, attendance, livestock, media capture)
│   ├── sync-status.tsx         # Pending media upload queue & manual sync trigger
│   └── global.css              # NativeWind / Tailwind CSS entry point
├── lib/                        # Shared Utilities & Business Logic
│   ├── firebase.ts             # Firebase app, Auth persistence, Firestore local cache, Storage init
│   ├── tenant.ts               # Multi-tenant models, User roles (Owner/Admin/Supervisor/Worker), License hooks
│   └── sync.ts                 # Pending media queue (AsyncStorage) & upload processing logic
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
    - `tenants`: Stores tenant profile, `ownerId`, and `license` metadata (`{ planType, maxUsers, maxStorageBytes, currentUsersCount, currentStorageBytes, enforced: false }`).
    - `users`: Mapped by Auth UID containing `{ tenantId, role: 'owner' | 'admin' | 'supervisor' | 'worker', email, displayName }`.
    - `agbelouve-farm-daily-logs`: Scoped with `tenantId` field on every document.
  - **Auth**: Initialized with `getReactNativePersistence(AsyncStorage)`.
- **Offline Sync Queue**:
  - `lib/sync.ts` stores pending media uploads in `AsyncStorage` under `@farm_manager_sync_queue`.
  - Media item schema (`PendingMedia`): `id`, `logId`, `tenantId`, `localUri`, `type` (`photo`|`video`|`voice`), `fileName`, `status` (`pending`|`uploading`|`completed`|`failed`), `progress` (0-100), `retryCount`, `errorMessage`, `createdAt`.
  - Uses `uploadBytesResumable` for streaming real-time percentage progress updates to UI modal/badges.
  - Storage paths: `tenants/{tenantId}/logs/{logId}/{fileName}`.


- **Hardware Integration**:
  - `expo-location`: High-accuracy GPS tagging for log submissions.
  - `expo-camera` / `expo-image-picker`: Photo and video capture (minimum 2 photos required for submission).
  - `expo-av`: Audio recording for voice notes.

---

## 📋 Standard Workflow for Modifications

1. **Inspect Target Files**: Read existing code using line ranges to minimize token consumption.
2. **Implement Changes**: Ensure TypeScript types and components maintain offline compatibility.
3. **Verify**: Ensure code compiles without broken imports or missing properties.
4. **Update Documentation**: Always update `AGENTS.md`, `README.md`, and `CHANGELOG.md` with the **What, Why, and How**.
