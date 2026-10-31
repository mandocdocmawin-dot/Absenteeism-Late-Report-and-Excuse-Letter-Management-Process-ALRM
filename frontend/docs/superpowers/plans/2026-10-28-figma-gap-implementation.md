# Figma page gap implementation

Goal: Implement missing desktop page families from ALRM Figma file tbmJgm9nCtJfOgPXWYHzaj. All edits stay inside frontend; backend is read-only and Git mutations are prohibited. Preserve the existing revised dashboard styling, Inter branding, hover sidebar, and existing functional flows.

Figma MCP session: f8def421-3937-47ac-961a-90ea6a763d32.
Read design-to-code guidance before design-context calls and reuse actual codebase primitives. Design context and screenshots have been obtained for the missing desktop families.

## Inventory

| Design family | Figma node | Existing implementation | Work |
| --- | --- | --- | --- |
| Authentication / OTP / pre-registration | 1549:5290,1549:5622 | Login, OTP and ProfileSetup | Retain |
| Student dashboard, records, request forms, settings, notifications, logout | 1680:10626,1712:9336,1803:13191,1911:16324 | Implemented with current revised design | Retain |
| Instructor dashboard, courses, student records, request status views, settings, logout | 1680:9344,1680:9490,1680:9752 | Implemented | Retain |
| Program Head overview, instructors/details, reports, at-risk list, settings, logout | 1295:5001,1126:10567,1295:9859,2470:15515 | Implemented | Retain |
| Admin User Management approved/waiting views | 1004:959,1110:10515,1082:8015 | Staff-role assignment only at /user-management; separate student/instructor directories exist | Add role/program/search/status views and supported status/role actions |
| Admin Program Overview | 1004:897 | /programs is CRUD, not attendance/program overview | Add /program-overview, actual aggregate metrics and program table |
| Admin Activity Log | 2367:14302 | Missing | Add /activity-log with available recent flag events; explain full audit history unavailable |
| Admin Manage / Assign Instructor | 2378:14885,2379:15052,2568:13690 | /classes is CRUD, no assignment/edit workflow | Add /manage with program filter and assignment dialog using PATCH classes |
| Program Head Activity Log submitted/flagged | 2412:12355,2419:13885 | Missing | Add /program-head/activity-log derived from program-scoped requests/flags |
| Admin reports | 1071:6507,1071:7056,1071:7253 | /reports exports real requests; aggregate summary data unavailable | Retain export, expose navigation; do not fabricate summary attendance records |
| Mobile page | 188:1507 | Six mobile reference screens explicitly excluded | No implementation |

## Backend constraints verified read-only

- Admin dashboard supplies global totals, program student counts, and at most ten recent flags; no public API exposes AuditLog history. Do not invent /audit endpoints or pretend recent flags are a complete log.
- Program-head requests include enrollment.student, class.instructor, reviewer, followupFlag. Flagged students are independently program-head-scoped.
- Admin classes permit instructor/program/section updates. instructor_id is non-null, required UUID; unassign cannot be implemented by submitting null. Disable unsupported unassignment with an explanation; never delete a class as a substitute.
- Admin user/status and role endpoints exist. Surface validation errors and do not fabricate successful approval.
- Per-program risk and pending totals absent from API must be unavailable, never zeros inferred from the limited recent flags.

## Execution

- [x] Implement User Management and tests in a separate page; retain existing directories.
- [x] Implement instructor assignment management and tests using supported class updates.
- [x] Implement Program Overview and activity pages with real sources and explicit capability limits.
- [x] Integrate protected routes and admin/program navigation without removing existing destinations.
- [x] Fix shared sidebar hover persistence on route navigation with a regression check.
- [x] Run targeted tests, scoped lint, production build, and browser checks using isolated frontend fixtures when authenticated access is unavailable.

## Corrections and verification

- User superseded the attendance-severity request with the two-tab Activity Log reference. Submitted columns: Students, Date, Requests, Action, Instructor. Flagged columns: Students, Date, Class, Record, Flagged by. The assigned class instructor supplies Flagged by, as explicitly requested. Removed additional filters and the explanatory footer from this page. Historical review events retain the recorded reviewer.
- Profile chevrons removed across role headers. Sidebar initialization inherits actual outgoing hover before paint; no inline width probing. Browser checks confirmed expanded 280px sidebar after consecutive navigation clicks while hovered.
- Email delivery has no preference mutation endpoint. Replaced the misleading disabled/off switch with a School-managed status. No real email was sent and deployed queue/mail delivery was not verified.
- Program routes can verify server-assigned membership for instructor accounts via the existing program-head dashboard endpoint before rendering content. Ordinary instructors remain denied by the server.
- Browser checks used temporary synthetic fixtures with all API traffic intercepted and mutations disabled. Confirmed program tab columns/instructor join, admin overview and user list, assignment dialog/dependent selectors, no profile chevrons, and 390px viewport containment with table-only horizontal scrolling. Temporary fixture removed; screenshot retained at frontend/docs/program-head-activity-preview.png and explicitly labeled as synthetic verification data.
- Production build, scoped ESLint, and all 325 tests passed. Existing large-chunk build warning remains.

No commits, pushes, backend edits, or production API mutations during verification.
