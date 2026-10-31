# Notification Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate assigned-instructor request notices and Program Head attendance notification routing using only server-owned notification records.

**Architecture:** Keep server notifications authoritative. Extend the shared mapper for the backend's critical threshold type and route Program Head critical/IR notifications to the flagged Activity Log tab. Do not create administrator fallbacks.

**Tech Stack:** React, JavaScript, Vite, Node test runner

**Spec:** `frontend/docs/superpowers/specs/2026-10-29-notification-interactions-design.md`

## Global Constraints

- Do not edit, create, or delete any file under `backend/`.
- Modify and create files only under `frontend/`.
- Do not fabricate notification events from aggregate counts.
- Do not stage or commit the user's existing repository changes.

## Review Focus

- A Program Head's critical notice must use `thresholdAlerts`, not `requestUpdates`.
- Critical and IR notices must open a view containing their corresponding flag.
- Warning notices must retain their existing request destination because warnings do not create flags.
- Instructor co-head notifications must remain visible to instructor-role recipients.
- Administrators must not receive Program Head threshold records through frontend role remapping.

---

### Task 1: Threshold mappings and Activity Log destinations

**Files:**
- Modify: `frontend/src/components/notifications/notificationData.js`
- Modify: `frontend/tests/staff-notifications.test.js`

**Interfaces:**
- Consumes: backend notification records with `type`, `user_id`, `request_id`, `message`, and `date_sent`
- Produces: `notificationActivity(records, role, preferences, userId)` entries with role-correct Activity Log `href` values

- [x] Add failing tests proving `threshold_critical` is an attendance alert and Program Head critical/IR destinations open the flagged Activity Log.
- [x] Run `node --test tests/staff-notifications.test.js` and confirm the new assertions fail for the missing mapping/routing.
- [x] Add the minimal recipient, threshold-preference, and destination mappings.
- [x] Run `node --test tests/staff-notifications.test.js` and confirm it passes.

- [x] Run the focused notification tests, full frontend test suite, targeted ESLint, build, and `git diff --check`.

