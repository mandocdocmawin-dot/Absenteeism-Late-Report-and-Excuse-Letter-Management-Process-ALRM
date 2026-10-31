# Progressive Dashboard Loading

**Goal:** A reload should show the centered school logo during session restoration, then the requested page's own placeholders. Reveal each section when its data is ready, without another full-page reset. In-app navigation remains SPA navigation without replaying the startup screen.

**Constraints:** Frontend only. No backend writes or Git operations. Do not bypass session validation, expose cached personal data, cache protected responses, introduce mock production records, or delay ready sections artificially.

## Approach
- Reuse AuthLoading for startup/session validation, with a neutral loading label outside sign-in routes. Preserve the existing 503 retry screen on failure.
- Remove the superseded session skeleton and cosmetic layout hint. Protected content still waits for verified authorization; no role or personal data is cached for the loading screen.
- Replace dashboard-level Promise.all loading gates with section-specific readiness. Reuse current API clients, hooks, and skeleton shapes.
- Keep resolved sections visible when another endpoint is pending or fails. Show errors and safe retry for the affected resource; never render false zeros while data is unknown.

## Ownership
- Main: shared session layout hint, instructor dashboard progressive regions, integration tests and browser verification.
- Student worker: student dashboard, metrics, heading and student placeholder exports; student progressive tests only.
- Staff worker: program-head and administrator dashboard data readiness and their tests; staff placeholder exports if needed.

## Checks
- [x] Regression tests fail before each implementation.
- [x] Logo-first restoration followed by page placeholders, with no personal data or unauthorized route access.
- [x] Independent success/failure/retry states and stale-request cleanup.
- [x] Instructor/Student/Program/Admin partial readiness; no fake empty or zero data.
- [x] Full suite, scoped ESLint, production build and delayed-response browser checks.
- [x] Delete temporary fixtures and close agent-created test tabs.

## Verification
- Initial progressive-loading suite: 265 tests passed. The follow-up logo-first startup has its own regression checks; final verification is recorded below.
- Isolated browser checks held account and resource responses separately. Instructor metric placeholders progressed from four to two to none; ready totals stayed mounted. Student request metrics and notifications appeared before attendance and classes. Program report chart appeared before metadata and flags. Administrator metrics and staff rows appeared before programs/classes, with dependent actions still disabled.
- Read-only independent review reported no actionable correctness or security findings.
- Temporary preview fixture and agent-created test tab removed. Backend and Git were not changed.

## Logo-First Startup Follow-Up
- The user requested a centered-logo startup screen before page skeletons instead of a skeleton during session validation. Existing page resource loading remains progressive.
- Regression tests verify the logo on protected paths, unchanged sign-in loading, safe authorization, failure/retry, and page-specific skeletons after verification.
- Isolated browser check: logo while account response waits; dashboard skeleton after account verification; sidebar navigation to Class Requests shows only its matching page skeleton; session checks remain at one; releasing reports reveals the page without another logo. No backend mutations were sent.
- Final verification: 261 tests passed, scoped ESLint passed, production build passed with the existing large-bundle warning. Independent review found no actionable issues. Temporary startup fixture and test tab removed.
