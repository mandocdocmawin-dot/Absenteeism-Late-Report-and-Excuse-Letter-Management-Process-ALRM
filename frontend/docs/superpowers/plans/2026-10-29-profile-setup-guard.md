# Profile Setup Completion Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the pre-dashboard submit button unavailable until all role-specific profile requirements are complete, with submit-time validation retained.

**Architecture:** Add a pure readiness helper to the existing profile setup utilities and consume it in `ProfileSetup.jsx`. Staff account identity comes from the authenticated `user.id`, is displayed read-only, and is never added to the API payload.

**Tech Stack:** React 19, JavaScript, Vite, Node test runner

**Spec:** `frontend/docs/superpowers/specs/2026-10-29-profile-setup-guard-design.md`

## Global Constraints

- Modify frontend files only; do not edit `backend/`.
- Do not change the complete-profile API payload contract.
- Use JavaScript and JSX, not TypeScript.
- Reuse the existing form, validation, and UI components.

## Review Focus

- Whitespace-only Student IDs must keep the button disabled.
- A year value outside the selected program's allowed options must keep the button disabled.
- Staff without an authenticated account ID must keep the button disabled.
- A program ID not present in the loaded program list must keep the button disabled.
- Program loading, errors, and active submission must continue disabling the button.

---

### Task 1: Add and consume the profile readiness guard

**Files:**
- Modify: `frontend/src/lib/profileSetup.js`
- Modify: `frontend/src/pages/ProfileSetup.jsx`
- Create: `frontend/tests/profile-setup-guard.test.js`

**Interfaces:**
- Consumes: `normalizeRole(role)`, the authenticated `user.id`, selected program state, and the existing year option list.
- Produces: `isProfileSetupReady({ role, userId, programId, selectedProgramId, studentNumber, yearLevel, yearOptions }) -> boolean`.

- [ ] **Step 1: Write the failing readiness tests**

Test that students require a loaded matching program, trimmed Student ID, and allowed year; staff require a loaded matching program and authenticated user ID; unsupported roles remain unavailable.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/profile-setup-guard.test.js`

Expected: FAIL because `isProfileSetupReady` is not exported.

- [ ] **Step 3: Implement the minimal pure helper**

Add `isProfileSetupReady` to `src/lib/profileSetup.js` using existing role normalization and value checks.

- [ ] **Step 4: Run the helper test and verify GREEN**

Run: `node --test tests/profile-setup-guard.test.js`

Expected: PASS.

- [ ] **Step 5: Wire the guard into the existing form**

Render authenticated `user.id` as a read-only Account ID for Instructor and Program Head users. Derive form readiness with `isProfileSetupReady`, add it to the submit button's disabled condition, and leave `validate(payload)` before `saveProfileSetup()`.

- [ ] **Step 6: Verify the frontend change**

Run focused tests, targeted ESLint, `npm run build`, and `git diff --check` for the changed frontend files.

