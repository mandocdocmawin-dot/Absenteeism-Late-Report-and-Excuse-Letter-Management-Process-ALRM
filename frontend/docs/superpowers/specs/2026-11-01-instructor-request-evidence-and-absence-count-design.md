# Instructor Request Evidence and Absence Count Design

## Intent

Make instructor class requests recoverable when a browser cannot preview a PDF, and make the Absent tab report absence counts instead of showing the Late tab's metric.

## Scope and constraints

- Change only `frontend/`; backend code and contracts remain untouched.
- Keep image evidence preview behavior unchanged.
- Keep the Late tab's `Minutes Late` column and values unchanged.
- On the Absent tab, show each student's cumulative non-cancelled absence requests for that class.
- Reuse the existing evidence blob URL and class-record aggregation; add no dependency.

## Approaches

- PDF fallback: selected an anchor inside the existing PDF `<object>` fallback. It appears only when embedded preview is unavailable. An always-visible download action was rejected because the requested behavior is fallback-only; JavaScript preview-failure detection was rejected as unreliable across browsers.
- Absence metric: selected the existing class/student aggregation used by instructor class records. Counting only the currently filtered or paginated rows was rejected because the value would change with filters and pages.

## Behavior

- A ready PDF renders the existing preview object. Its fallback contains a `Download PDF` action with filename `attachment.pdf`.
- The requests table receives the active request type. `absence` renders `Number of Absences` and the cumulative count; `late` renders `Minutes Late` and `minutes_late`.
- Missing count or minute data renders the existing em dash fallback.

## Validation

Add focused instructor-request tests for the PDF fallback action, absence column/count, and unchanged late column/minutes. Run the focused test, targeted ESLint, and the production build.
