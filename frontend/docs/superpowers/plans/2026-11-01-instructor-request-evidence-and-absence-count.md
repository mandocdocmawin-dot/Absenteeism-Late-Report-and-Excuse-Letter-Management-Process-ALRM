# Instructor Request Evidence and Absence Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PDF download fallback to instructor evidence viewing and show cumulative absence counts on the Absent class-request tab.

**Architecture:** Extend the shared evidence renderer's existing PDF fallback with a download anchor that reuses the fetched object URL. Extend the existing per-record attendance summary with the class-record absence count, then let the requests table select its fourth column from the active request type.

**Tech Stack:** React 19, JavaScript/JSX, Vite, Node test runner, ESLint, existing Tailwind utilities.

**Spec:** `frontend/docs/superpowers/specs/2026-11-01-instructor-request-evidence-and-absence-count-design.md`

## Global Constraints

- Modify only files under `frontend/`; never modify `backend/`.
- Add no dependency and make no API-contract change.
- Preserve image previews, PDF previews when supported, and Late-tab minutes.
- Count non-cancelled absence requests per student and class using existing class-record aggregation.
- Do not stage or commit automatically; the user controls Git delivery.

## Review Focus

- PDF preview unavailable: the fallback must expose a usable `attachment.pdf` download without refetching.
- PDF preview available: the existing `<object type="application/pdf">` must remain.
- Absent tab with multiple records for one student/class: every row must show the same cumulative count.
- Cancelled absence request: it must not increase the count.
- Late tab: its label and `minutes_late` values must remain unchanged.

---

### Task 1: PDF preview fallback download

**Files:**
- Modify: `frontend/src/components/evidence/EvidenceViewerDialog.jsx`
- Test: `frontend/tests/instructor-requests.test.js`

**Interfaces:**
- Consumes: ready evidence state `{ status: "ready", mimeType: "application/pdf", url: string }`.
- Produces: the existing PDF `<object>` with a fallback anchor labeled `Download PDF`, `href={state.url}`, and `download="attachment.pdf"`.

- [ ] **Step 1: Write the failing PDF fallback test**

Extend `embedded evidence content renders only supported PDF and image elements` to assert that ready PDF markup contains the preview object, `Download PDF`, the blob URL, and `download="attachment.pdf"`; retain image and unsupported-type assertions.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern="embedded evidence content" tests/instructor-requests.test.js`

Expected: FAIL because the PDF fallback does not contain a download action.

- [ ] **Step 3: Implement the fallback anchor**

In `EvidenceContent({ state })`, keep the PDF object and replace its fallback paragraph with explanatory text plus an anchor using the ready blob URL and fixed filename `attachment.pdf`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test --test-name-pattern="embedded evidence content" tests/instructor-requests.test.js`

Expected: PASS.

- [ ] **Step 5: Prepare, but do not execute, the user-controlled commit**

Suggested subject: `fix(instructor): add PDF download fallback`

### Task 2: Type-specific request metric

**Files:**
- Modify: `frontend/src/pages/auth/instructor/InstructorRequests/requestData.js`
- Modify: `frontend/src/pages/auth/instructor/InstructorRequests/RequestsTable.jsx`
- Modify: `frontend/src/pages/auth/instructor/InstructorRequests/InstructorRequests.jsx`
- Test: `frontend/tests/instructor-requests.test.js`

**Interfaces:**
- Consumes: `requestAttendance(records)` and active `type: "absence" | "late"`.
- Produces: attendance-map entries that retain alert fields and add `absences`/`lates`; `RequestsTable({ records, attendance, type, onReview, caption })` with a type-specific fourth column.

- [ ] **Step 1: Write failing table and aggregation tests**

Add assertions that an absence table renders `Number of Absences`, omits `Minutes Late`, and shows the cumulative non-cancelled absence count from its attendance summary. Keep a separate late-table assertion for `Minutes Late` and `17`. Add an aggregation assertion proving two absence requests for the same student/class produce `absences: 2` while a cancelled request does not increase it.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test --test-name-pattern="request tabs|absence count" tests/instructor-requests.test.js`

Expected: FAIL because the table columns are static and attendance entries lack counts.

- [ ] **Step 3: Extend `requestAttendance(records)`**

For each record, reuse `buildClassRecords(records)` to locate its student summary and merge `absences` and `lates` into the existing alert result without changing the alert field names. Return `null` only when the course or student cannot be resolved.

- [ ] **Step 4: Make `RequestsTable` type-aware**

Add the `type` prop. Build the fourth column label as `Number of Absences` for `absence` and `Minutes Late` for `late`. Render `attendance.get(record.id)?.absences ?? "—"` for absence rows and preserve `record.minutes_late ?? "—"` for late rows. Continue rendering threshold information only when percentage/label data exists.

- [ ] **Step 5: Pass the active type from `InstructorRequests`**

Change the existing `<RequestsTable>` call to include `type={type}`; do not change filtering, pagination, export, or modal selection.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `node --test tests/instructor-requests.test.js`

Expected: all instructor-request tests pass.

- [ ] **Step 7: Run final frontend verification**

Run: `npx eslint src/components/evidence/EvidenceViewerDialog.jsx src/pages/auth/instructor/InstructorRequests/requestData.js src/pages/auth/instructor/InstructorRequests/RequestsTable.jsx src/pages/auth/instructor/InstructorRequests/InstructorRequests.jsx tests/instructor-requests.test.js`

Run: `npm run build`

Expected: both commands exit 0.

- [ ] **Step 8: Prepare, but do not execute, the user-controlled commit**

Suggested subject: `fix(instructor): show request metrics by type`
