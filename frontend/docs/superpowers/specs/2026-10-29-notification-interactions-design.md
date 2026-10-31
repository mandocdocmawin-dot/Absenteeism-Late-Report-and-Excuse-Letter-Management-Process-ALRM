# Notification Interactions Design

## Intent

Connect the notification UI to the pulled backend contracts so a student's new request reaches the instructor assigned to the selected class and Program Head attendance notifications open the relevant Activity Log view.

## Constraints

- All created and modified files stay under `frontend/`; `backend/` is read-only contract evidence.
- Server notification rows remain authoritative and are never duplicated by a frontend fallback.
- Frontend fallbacks may use only real records returned by authenticated APIs; do not invent recipients, students, dates, or threshold events.
- Preserve the existing notification bell, notification page, local preference handling, and Activity Log tables.

## Current contracts

- Creating a request produces a `new_request` notification owned by the selected class's assigned instructor. The instructor request endpoint also exposes the request and its class `instructor_id`, which remains the frontend fallback when a notification response is unavailable.
- Program Heads receive `threshold_warning`, `threshold_critical`, and `ir_escalation` notification rows.
- Critical and IR stages create `FollowupFlag` records that Program Heads can read through their scoped Activity Log.
- Both Activity Log pages already render these real flag records.

## Approach

Use server notification rows only. Add the missing `threshold_critical` mapping and route Program Head critical/IR notices to the flagged Activity Log tab. Administrators remain unchanged because the backend does not currently create administrator-owned threshold notification rows.

Rejected alternatives:

- Deriving administrator notices from dashboard flags or aggregate counts was rejected because the user chose server-notification routing only.
- Creating Program Head fallbacks from flags was rejected because Program Heads already receive authoritative server notifications and would see duplicates.
- Editing backend notification recipients was rejected because `backend/` is explicitly read-only.

## Expected behavior

- An instructor sees only new requests whose class is assigned to that instructor.
- Program Head warning, critical, and IR notices honor the attendance-alert preference. Critical and IR notices open `/program-head/activity-log?tab=flagged`; preventive warning notices retain the request destination because they do not create flags.
- Administrators do not receive threshold notifications until the backend creates administrator-owned notification rows.
- Server notification read state remains account-backed.

