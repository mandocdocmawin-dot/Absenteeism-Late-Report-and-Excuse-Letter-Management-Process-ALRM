# Program Head Profile Bypass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send authenticated Program Heads directly past `/complete-profile` while retaining that route for students and instructors.

**Architecture:** Keep the route and shared guard. Treat normalized `program` users as profile-complete in `isProfileSetupComplete`; existing admin assignment authorization continues to control Program Head pages.

**Tech Stack:** React, React Router, JavaScript, Node test runner.

**Spec:** User clarification in the current chat dated 2026-10-29.

## Global Constraints

- Change frontend guard behavior only.
- Do not change Program Head authorization or backend assignments.
- Preserve student and instructor profile requirements.

## Review Focus

- `program_head` and normalized `program` roles both bypass setup.
- Program Heads bypass even without browser confirmation state.
- Instructors still require assigned program and session confirmation.
- Incomplete students still require setup.

---

### Task 1: Bypass profile setup for Program Heads

**Files:**
- Create: `frontend/tests/program-head-profile-bypass.test.js`
- Modify: `frontend/src/lib/profileSetup.js`

**Interfaces:**
- Consumes: `isProfileSetupComplete(user, options)` and `needsProfileSetup(user, options)`.
- Produces: Program Head completion independent of the profile form.

- [x] **Step 1: Write the failing test**

Assert that `program_head` users are complete and do not need setup without program/session markers, while incomplete instructor and student users still need setup.

- [x] **Step 2: Verify RED**

Run: `node --test tests/program-head-profile-bypass.test.js`

Expected: FAIL because Program Heads currently require assigned program and session confirmation.

- [x] **Step 3: Implement the minimal guard change**

Return complete for normalized `program` roles before student/instructor profile checks.

- [x] **Step 4: Verify GREEN and regressions**

Run the focused test, related session/guard tests, targeted ESLint, and the frontend build. Report unrelated failures from paused work separately.
