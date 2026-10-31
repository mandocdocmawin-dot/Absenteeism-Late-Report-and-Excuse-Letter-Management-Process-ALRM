# Frontend Notification, Profile Gate, and Admin Data Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove self-submission entries from student notifications, require instructor and program-head profile confirmation before dashboard access, and ensure Program Overview rows contain only real API-backed database values.

**Architecture:** Keep each fix at the existing shared source of truth: student request-event projection, profile-route completion predicate, and Program Overview row projection. Reuse current APIs and components, add no dependencies, and never fabricate missing database values. The backend is read-only evidence and receives no edits.

**Tech Stack:** React 19, React Router, Vite, JavaScript/JSX, Node test runner.

**Spec:** User request dated 2026-10-29 in the current chat.

## Global Constraints

- Create, modify, or delete files only under `frontend/`.
- Treat every file under `backend/` as read-only.
- Use JavaScript/JSX only; do not add TypeScript.
- Use existing helpers, APIs, UI primitives, and loading/error/empty states.
- Do not add mock rows, speculative fallbacks, new dependencies, or new backend contracts.
- Write each regression test first and confirm that it fails for the intended reason before changing production code.
- Do not commit, push, or modify Git history unless the user separately requests it.

## Diagnosis

1. `recentRequestActivity()` always creates a `*-submitted` event from every student-owned request. Both the dashboard notification list and the student bell/full notification page consume this shared projection, so the student's own newly submitted request is intentionally rendered as a notification.
2. `isProfileSetupComplete()` treats any staff `program_id` or `programs` membership as proof that the pre-dashboard form was submitted. Existing instructor/program-head records can already have both fields from seeding or administrative assignment, so the route guard redirects straight to the dashboard. The authenticated user response has no dedicated profile-completion field; frontend-only enforcement therefore needs a confirmation tied to the current authenticated browser session and written only after `POST /api/complete-profile` succeeds.
3. `AdminProgramOverview` renders `No data yet` for per-program at-risk and pending-request cells because `/api/admin/dashboard` does not return those per-program counts. Existing admin APIs do provide real program, student, class, and instructor data. Showing only those contract-backed columns is truthful; deriving at-risk totals from the limited recent-flags list or treating a date-bounded report as an all-time total would fabricate meaning.

## Review Focus

- A pending request must not create a student notification, while a later approved/noted/invalid decision must still create one.
- Removing submission events must affect the dashboard, bell, and full notification page through the same shared helper.
- A preassigned instructor or program head must still be redirected to `/complete-profile` until the current authenticated session records a server-confirmed form submission.
- A failed profile POST or a different authenticated session must not unlock dashboard access.
- Program Overview must never display a made-up zero or `No data yet` as though it were a database value.

---

### Task 1: Exclude student-owned submission events

**Files:**
- Modify: `frontend/tests/student-overview.test.js`
- Modify: `frontend/tests/student-notifications.test.js`
- Modify: `frontend/src/pages/auth/student/dashboard/studentOverview.js`

**Interfaces:**
- Consumes: student request records returned by `getStudentRequests()`.
- Produces: `recentRequestActivity(requests, limit)` containing only recorded instructor decision events for student notification surfaces.

- [ ] **Step 1: Write the failing projection tests**

  Update the shared-helper test so a pending request with a valid submission date produces no activity, while reviewed requests produce only `*-reviewed` events in review-date order.

- [ ] **Step 2: Write the failing notification-feed test**

  Update the API-backed student notification test so the first pending response yields an empty activity list and the subsequent approved response yields the reviewed event.

- [ ] **Step 3: Verify RED**

  Run: `node --test tests/student-overview.test.js tests/student-notifications.test.js`

  Expected: FAIL because current code still emits `request-1-submitted`.

- [ ] **Step 4: Implement the minimum shared fix**

  Change `recentRequestActivity(requests, limit)` to add an event only when the request has a supported reviewed status (`approved`, `noted`, or `invalid`) and a valid `date_reviewed`. Preserve request IDs, subject labels, ordering, timestamp validation, and limit behavior.

- [ ] **Step 5: Verify GREEN**

  Run: `node --test tests/student-overview.test.js tests/student-notifications.test.js`

  Expected: PASS.

### Task 2: Enforce staff profile confirmation per authenticated session

**Files:**
- Modify: `frontend/tests/profile-setup-guard.test.js`
- Modify: `frontend/src/lib/profileSetup.js`
- Modify: `frontend/src/pages/ProfileSetup.jsx`

**Interfaces:**
- Consumes: authenticated `user`, the current session version from `getSessionVersion()`, and browser session storage when available.
- Produces: a staff profile-confirmation helper used by `isProfileSetupComplete(user)` and a marker written only after the profile endpoint succeeds.

- [ ] **Step 1: Write the failing route-predicate tests**

  Add cases proving that an instructor/program head with `program_id` and populated `programs` still needs setup when no current-session confirmation exists; the same user becomes complete only after the confirmation helper records the current session; a changed session version is incomplete again. Keep existing student and admin completion rules unchanged.

- [ ] **Step 2: Write the failing form-success test**

  Assert that the form's successful submission path records staff confirmation only after `saveProfileSetup(payload)` resolves. Assert that a rejected save does not record confirmation.

- [ ] **Step 3: Verify RED**

  Run: `node --test tests/profile-setup-guard.test.js`

  Expected: FAIL because assigned program data currently bypasses the form and no session confirmation helper exists.

- [ ] **Step 4: Implement current-session confirmation**

  In `profileSetup.js`, add the smallest storage helper keyed by staff user ID and role, storing the current `getSessionVersion()` after a confirmed save. Make `isProfileSetupComplete(user)` require this marker for instructor/program roles; retain server-field validation for students and unconditional completion for admins. Treat missing/blocked storage as incomplete, with an in-memory confirmation fallback for the current page lifetime so a successful form can proceed.

- [ ] **Step 5: Mark confirmation after server success**

  In `ProfileSetup.jsx`, call the confirmation helper for staff immediately after `saveProfileSetup(payload)` succeeds and before refreshing the user and navigating. Do not mark on validation, request failure, or page load.

- [ ] **Step 6: Verify GREEN and route behavior**

  Run: `node --test tests/profile-setup-guard.test.js tests/session.test.js tests/session-loading.test.js tests/preview-role.test.js`

  Expected: PASS; assigned staff cannot satisfy `needsProfileSetup()` until the current session has a server-confirmed submission.

### Task 3: Render only real Program Overview row data

**Files:**
- Modify: `frontend/tests/figma-data.test.js`
- Modify: `frontend/tests/figma-pages.test.js`
- Modify: `frontend/src/pages/auth/admin/overviewData.js`
- Modify: `frontend/src/pages/auth/admin/AdminProgramOverview.jsx`

**Interfaces:**
- Consumes: `/api/admin/dashboard` program summaries and `/api/admin/classes` records.
- Produces: one row per non-General-Education program with database-backed department, student, class, and distinct-instructor counts.

- [ ] **Step 1: Write the failing row-projection test**

  Assert that `programOverviewRows()` returns the supplied student count, the real class count, and the distinct instructor count for each program. Assert that it does not expose `atRisk` or `pending` placeholder fields.

- [ ] **Step 2: Write the failing rendered-table test**

  Assert that Program Overview renders `Department`, `Students`, `Classes`, and `Instructors`, and does not render `No data yet`, `Students at Risk`, or per-program `Pending Requests` cells.

- [ ] **Step 3: Verify RED**

  Run: `node --test tests/figma-data.test.js tests/figma-pages.test.js`

  Expected: FAIL because the current row projection and table still include unsupported null fields and placeholder copy.

- [ ] **Step 4: Implement the contract-backed row**

  Update `programOverviewRows(dashboard, classes)` to expose `classes` from the program summary's `classes_count` when present, otherwise from matching class records, and retain distinct instructor counting. Update the table to render only the four supported columns and remove the unsupported-data note.

- [ ] **Step 5: Verify GREEN**

  Run: `node --test tests/figma-data.test.js tests/figma-pages.test.js tests/admin-dashboard.test.js`

  Expected: PASS.

### Task 4: Frontend regression proof

**Files:**
- Verify only; no unrelated cleanup.

- [ ] **Step 1: Run all frontend tests**

  Run: `node --test --test-reporter=dot tests/*.test.js`

  Expected: PASS, or report every pre-existing failure by name without hiding it.

- [ ] **Step 2: Run targeted lint**

  Run ESLint only on the production and test files changed by Tasks 1-3.

  Expected: PASS.

- [ ] **Step 3: Build the frontend**

  Run: `npm run build`

  Expected: PASS; report any existing chunk-size warning separately.

- [ ] **Step 4: Verify scope and whitespace**

  Run: `git status --short -- frontend` and `git diff --check -- frontend`.

  Expected: only the planned frontend files changed, with no whitespace errors and no backend writes.
