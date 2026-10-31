# Instructor Dashboard Implementation Plan

**Goal:** Match the supplied instructor dashboard using real reported requests.

**Architecture:** Keep the existing instructor shell and authenticated APIs. Derive report metrics in a pure helper, render a read-only overview, and link to the existing class records and request review routes.

**Tech Stack:** JavaScript React, Tailwind, existing Recharts and Lucide dependencies.

**Spec:** User screenshot and approval to count reported requests rather than daily attendance.

## Constraints
- Modify frontend only; no backend edits or Git mutations.
- Never substitute screenshot examples for live records.
- Use Asia/Manila dates, Monday-Sunday reporting weeks, and unique request IDs.
- Exclude cancelled requests. Keep distinct class IDs separate, including same-named courses.
- The API exposes courses through reports, not a full assigned-course roster. Show known courses without claiming completeness.
- Preserve the existing notification and request decision workflows.

## Tasks
- [x] Add regression tests for report counts, Philippine date boundaries, duplicate/cancelled records, missing schedules, and request/class links.
- [x] Add `dashboard/overviewData.js` for validated API loading and report-derived metrics; reuse existing class-record and schedule helpers.
- [x] Replace `InstructorDashboard.jsx` review table with `dashboard/InstructorOverview.jsx`, four metrics, `dashboard/WeeklyReportsChart.jsx`, semester summary, and attendance notice. Add the Dashboard header title in `pages/Dashboard.jsx`.
- [x] Add a matching instructor dashboard placeholder and update skeleton tests.
- [x] Run targeted tests, full frontend tests, scoped ESLint and production build. Inspect desktop/mobile browser rendering and real navigation with isolated test data; delete temporary browser fixtures.

## Follow-Up Verification
- Equal-width Class Requests columns measured 161.8px each at the tested desktop size; due-date font weight remains 400.
- Code review identified the backend's 500-record unpaginated limit. Dashboard requests now use existing pagination, with a 601-record/seven-page regression case.
- Ruling: add previous/next reporting-week controls after confirming the user's October 15 absence falls outside October 19-25. Keep actual date boundaries instead of counting historical records in the current week.
- Verified the real October 12-18 chart displays one absence and zero lates; today's metrics and semester totals remain unchanged.
- Mobile check found intrinsic width overflow from the screen-reader chart table. A clipped wrapper preserves accessibility and removes page-level overflow at 390px.
- Temporary preview data, mocked network handlers and test HTML were removed; none are shipped in the application.

## Review Focus
- API errors must remain retryable errors, never false zero metrics.
- Today/week use school time regardless of browser timezone.
- Pending summaries come from the dashboard snapshot; chart/history come from reported records.
- Long subject names and large course lists must not overlap or overflow the page.
- No warning or schedule data means an honest empty/not-provided state.
