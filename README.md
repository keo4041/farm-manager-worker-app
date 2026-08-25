# Agbelouve Farm Manager - Worker App

An offline-first React Native mobile application built with Expo for farm workers and managers at Agbelouve Farm. The app enables daily log collection (morning and evening shifts), GPS location tagging, livestock/attendance tracking, and media uploads (photos, videos, and voice notes) with robust offline queueing capabilities.

---

## 🏗️ System Architecture

The app is architected with an **offline-first pattern**. All Firestore data mutations are cached locally using Firestore's `persistentLocalCache()`. Large binary media files (photos, videos, voice recordings) captured while offline are queued in `AsyncStorage` and uploaded to Firebase Cloud Storage when network connectivity is available.

```mermaid
flowchart TD
    subgraph MobileApp["Expo React Native Worker App"]
        UI["App Screens (app/)
        - index.tsx (Role-Adaptive Dashboard)
        - login.tsx & register-tenant.tsx (Auth & Tenant Wizard)
        - team-management.tsx (RBAC & User Management)
        - form-wizard.tsx (Daily Log Form)
        - sync-status.tsx (Media Queue)"]
        
        Sensors["Expo Native Modules
        - expo-location (GPS Geofence)
        - expo-camera (Photo & Video Capture)
        - expo-av (Voice Note Recording)"]
        
        LocalStorage["Local Persistent Storage
        - Firestore Local Cache (persistentLocalCache)
        - AsyncStorage (@farm_manager_sync_queue)"]
    end

    subgraph SyncEngine["Sync & Tenant Engine (lib/sync.ts & lib/tenant.ts)"]
        QueueProcessor["processSyncQueue() & checkLicenseQuota()
        - Tenant-scoped storage pathing
        - Resumable upload bytes
        - License & quota verification"]
    end

    subgraph FirebaseCloud["Firebase Cloud Infrastructure"]
        Auth["Firebase Authentication"]
        Firestore["Cloud Firestore
        - tenants (Tenant Profiles & Licenses)
        - users (Auth UID -> tenantId + Role)
        - agbelouve-farm-daily-logs (Daily Logs)"]
        Storage["Firebase Cloud Storage
        Bucket path: tenants/{tenantId}/logs/{logId}/{fileName}"]
    end

    UI --> Sensors
    UI --> LocalStorage
    LocalStorage -->|Pending Media Items| SyncEngine
    SyncEngine -->|Upload Media Blobs| Storage
    SyncEngine -->|Update Document Media URLs| Firestore
    UI -->|Authenticate Worker| Auth
    UI -->|Offline-First Read/Write| Firestore
```

---

## ✨ Features

- **Multi-Tenant Architecture**: Full tenant data isolation using `tenantId` scoped collections and Storage buckets.
- **Role-Based Access Control (RBAC)**: Support for four user roles:
  - **Owner**: Full tenant administration, team creation, and quota monitoring.
  - **Admin**: User provisioning and farm operational oversight.
  - **Supervisor**: Log creation, team shift reviews, and sync monitoring.
  - **Worker**: Shift log entry and media recording.
- **In-App Team Management**: Owners and Admins can create and add team members during registration or post-creation via `team-management.tsx`.
- **Licensing & Quotas Hooks**: Built-in quota check hooks (`checkLicenseQuota`) for tracking active user counts and Cloud Storage bytes.
- **Shift Log Wizards**: Guided forms for **MORNING** and **EVENING** farm operations.
- **GPS Location Tagging**: Automatic GPS coordinate capturing for geofence validation.
- **Rich Media Attachments**: Photos, videos, and voice note recordings with resumable upload progress.
- **Offline Sync Queue**: Visual queue dashboard (`sync-status.tsx`) for tracking offline uploads and triggering manual syncs.
- **Bilingual Interface**: Dual English / French labeling.

---

## 📁 Repository Structure

- [`app/`](file:///home/kwami/code-projects/farm-manager/worker-app/app): Expo Router screens and file-based routing stack.
  - [`_layout.tsx`](file:///home/kwami/code-projects/farm-manager/worker-app/app/_layout.tsx): Stack navigator & header theme customization.
  - [`index.tsx`](file:///home/kwami/code-projects/farm-manager/worker-app/app/index.tsx): Main landing page with user role badge.
  - [`login.tsx`](file:///home/kwami/code-projects/farm-manager/worker-app/app/login.tsx): Authentication page with link to Tenant Registration.
  - [`register-tenant.tsx`](file:///home/kwami/code-projects/farm-manager/worker-app/app/register-tenant.tsx): Tenant onboarding wizard for farm owners.
  - [`team-management.tsx`](file:///home/kwami/code-projects/farm-manager/worker-app/app/team-management.tsx): User management dashboard & quota inspector.
  - [`form-wizard.tsx`](file:///home/kwami/code-projects/farm-manager/worker-app/app/form-wizard.tsx): Guided log collection wizard.
  - [`sync-status.tsx`](file:///home/kwami/code-projects/farm-manager/worker-app/app/sync-status.tsx): Queue inspector and upload trigger.
- [`lib/`](file:///home/kwami/code-projects/farm-manager/worker-app/lib): Shared helpers and API interfaces.
  - [`firebase.ts`](file:///home/kwami/code-projects/farm-manager/worker-app/lib/firebase.ts): Firebase configuration & offline persistence setup.
  - [`tenant.ts`](file:///home/kwami/code-projects/farm-manager/worker-app/lib/tenant.ts): Multi-tenant models, user roles, user provisioning, and quota hooks.
  - [`sync.ts`](file:///home/kwami/code-projects/farm-manager/worker-app/lib/sync.ts): Queue state management & background media upload processor.
- [`firestore.rules`](file:///home/kwami/code-projects/farm-manager/worker-app/firestore.rules): Production Firestore security rules enforcing multi-tenant isolation & RBAC.
- [`storage.rules`](file:///home/kwami/code-projects/farm-manager/worker-app/storage.rules): Production Cloud Storage rules scoping bucket access by `tenantId`.
- [`firebase.json`](file:///home/kwami/code-projects/farm-manager/worker-app/firebase.json): Firebase CLI project manifest.
- [`add-test-data.mjs`](file:///home/kwami/code-projects/farm-manager/worker-app/add-test-data.mjs): Utility script to insert mock log data into Firestore.

---

## 🔒 Deploying Firebase Security Rules

To deploy the multi-tenant security rules to your live Firebase project using Firebase CLI:

```bash
# Login to Firebase CLI
npx firebase login

# Deploy Firestore & Cloud Storage security rules
npx firebase deploy --only firestore:rules,storage
```



---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Expo Go app on mobile device OR Android Studio / Xcode emulator.

### Installation

```bash
# Install dependencies
npm install
```

### Running the App

```bash
# Start Expo development server
npm start

# Run directly on Android
npm run android

# Run directly on iOS
npm run ios

# Run in Web browser
npm run web
```

### Adding Seed Test Data

To push a sample daily log document to the Firestore database:

```bash
node add-test-data.mjs
```

---

## 📢 Mandatory Maintenance Directive

> [!IMPORTANT]
> **All contributors and AI agents MUST update [`AGENTS.md`](file:///home/kwami/code-projects/farm-manager/worker-app/AGENTS.md), [`README.md`](file:///home/kwami/code-projects/farm-manager/worker-app/README.md), and [`CHANGELOG.md`](file:///home/kwami/code-projects/farm-manager/worker-app/CHANGELOG.md) whenever changes are made to this repository.** Updates must clearly outline the **WHAT**, **WHY**, and **HOW** behind each modification.
