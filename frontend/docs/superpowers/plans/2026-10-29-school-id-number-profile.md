# School ID Number Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the frontend with `User.school_id_number` and let instructors enter a persisted Instructor ID instead of displaying the database UUID.

**Architecture:** Use the existing backend field and endpoint without aliases or schema changes. One role-neutral `schoolIdNumber` form value is labeled by role, validated locally, sent as `school_id_number`, and consumed consistently across frontend school-ID displays.

**Tech Stack:** React, JavaScript/JSX, Vite, Node test runner.

**Spec:** `frontend/docs/superpowers/specs/2026-10-29-school-id-number-profile-design.md`

## Global Constraints

- Do not add or rename backend fields; the current backend contract is authoritative.
- Program Heads continue to bypass profile setup.
- Preserve student profile behavior and existing UI components.
- Do not display or submit the internal user UUID as an Instructor ID.

## Review Focus

- Blank or malformed instructor IDs keep submission disabled or show a field error.
- Backend uniqueness errors for `school_id_number` appear under the role-specific ID input.
- Existing students remain profile-complete when `school_id_number` is present.
- Student/admin school-ID displays read the renamed backend property.
- Program Heads still bypass `/complete-profile`.

---

### Task 1: Align the frontend school ID contract

**Files:**
- Modify: `frontend/src/pages/ProfileSetup.jsx`
- Modify: `frontend/src/lib/profileSetup.js`
- Modify: `frontend/src/lib/formInputs.js`
- Modify: `frontend/src/api/profileSetup.js`
- Modify: frontend school-ID display consumers returned by `rg "school_student_id" frontend/src`
- Modify: affected frontend tests and fixtures

**Interfaces:**
- Consumes: backend `school_id_number` on authenticated and admin user resources.
- Produces: profile payload `{ program_id, school_id_number, year_level? }` and role-specific ID input behavior.

- [x] **Step 1: Update tests to the new contract**

Assert that instructors require and render an editable Instructor ID, `prepareProfileInput` sanitizes and sends `school_id_number`, student completion uses the renamed field, and no frontend source consumer relies on the obsolete property.

- [x] **Step 2: Verify RED**

Run focused profile/input tests. Expected: FAIL because the frontend still uses `school_student_id` and displays the UUID.

- [x] **Step 3: Implement the minimum frontend alignment**

Rename form state and payload mapping to `school_id_number`, require it for instructors and students, update the completion predicate, and update frontend display consumers.

- [x] **Step 4: Verify GREEN**

Run focused tests, targeted ESLint, the complete frontend suite, production build, and `git diff --check`. Report unrelated baseline failures separately.
