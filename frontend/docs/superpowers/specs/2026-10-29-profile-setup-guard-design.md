# Profile Setup Completion Guard Design

## Intent

Prevent incomplete pre-dashboard profile forms from being submitted. The primary guard disables the Continue to Dashboard button until the current role's required values are complete, while the existing submit-time validation remains the final frontend check before any API request.

## Requirements

- Students require a selected program, a non-empty Student ID, and a valid year level.
- Instructors and Program Heads require a selected program and the authenticated `user.id`.
- Staff account IDs are displayed read-only and are not added to the profile API payload.
- The button remains disabled while programs load, program loading fails, or submission is in progress.
- The existing `validate(payload)` call remains in the submit handler and stops invalid submissions before `saveProfileSetup()`.
- Only files under `frontend/` may change; no backend files or API contracts change.

## Approach

Use one small pure readiness helper in the existing profile-setup utility module. The page derives button availability from that helper and renders the authenticated staff ID with the existing read-only field component. This keeps the UI guard testable without adding dependencies or duplicating backend logic.

## Alternatives Considered

- Native `required` attributes still allow the button to be pressed and only validate after submission, so they do not meet the requested disabled-button behavior.
- Sending an editable staff ID would change the existing API contract, which currently accepts only `program_id` for staff and is outside the frontend-only scope.

