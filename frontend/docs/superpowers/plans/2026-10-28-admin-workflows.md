# Admin workflow updates

**Goal:** Apply the user's ten admin refinements using existing API contracts.
**Architecture:** Keep existing account mutations, shared breadcrumbs, buttons and loading states. Read the server's XLSX export for the on-screen report and download that same file. Aggregate weekly absence reports from the same export; missing late records remain unavailable because the server filters on absence start date.
**Tech stack:** React JavaScript, Tailwind, Base UI, Recharts, browser XLSX reader.
**Spec:** User's screenshots and ten-item request in this chat.

## Constraints
- All writes stay in frontend. Backend is read-only. No Git mutations.
- Preserve student account behavior and authorization/self-account checks.
- No invented records or zeroes for missing late data.

## Review focus
- Preview and downloaded file must use the same generated snapshot despite later filter edits.
- Failed or superseded generation must not publish a stale report.
- School weeks use Asia/Manila and handle month/year boundaries.
- Empty reports, invalid date ranges and export limits retain visible errors.
- Staff dialogs must preserve keyboard access and prevent duplicate mutations.

## Tasks
- [x] Add failing tests for school-week boundaries, report parsing/aggregation and generation snapshot flow; implement the minimum XLSX adapter and preview.
- [x] Add this-week/last-week chart selection using actual exported absence records. Cache weeks separately to respect the 5,000-row export ceiling and export rate limit; late counts remain unavailable.
- [x] Move non-student account details/actions into one accessible modal; retain student inline actions and existing API restrictions. Run targeted account checks.
- [x] Apply two-column program cards, wider class-form gaps, navy Manage programs, 20px assignment dialog, and destructive Remove styling.
- [x] Remove the Activity Log blue notice and add shared breadcrumbs for Programs and Classes destinations.
- [x] Run targeted checks, full frontend tests, build and changed-file lint; inspect the rendered workflow with isolated synthetic data.

Validation: 408 frontend tests passed, plus targeted checks after the review refinement. Build and scoped lint passed. Browser checks used synthetic accounts/reports and verified account actions, report snapshots, last-week selection, two-column cards, breadcrumbs and computed 20px assignment-dialog radius. No live account decisions were submitted.
