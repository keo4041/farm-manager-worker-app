# Changelog

All notable changes to the **Agbelouve Farm Manager - Worker App** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## 🚨 Maintenance Policy Rule

> Every change to this codebase MUST be accompanied by an entry in `CHANGELOG.md`, as well as updates to `AGENTS.md` and `README.md`, detailing **What** changed, **Why** it was changed, and **How** it was implemented.

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
