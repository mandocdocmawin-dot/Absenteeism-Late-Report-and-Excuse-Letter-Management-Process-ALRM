# Instructor decisions and follow-ups

[API documentation index](README.md)

`GET /instructor/requests` lists requests linked to the caller's own teaching assignment versions with `enrollment.student`, `enrollment.class`, and `teachingAssignment`. Historical assignments remain readable by the original instructor; only active assignments permit request decisions. The replacement instructor does not inherit prior requests. Request JSON overlays `enrollment.class` with the stored `class_snapshot`, keeping the existing response shape historical. It supports pagination; export-only filters are not applied to this list.

`PATCH /instructor/requests/{request}/decision` requires `{"status":"approved"}`, `noted`, or `invalid`. Only the actual instructor may decide; administrators/program heads cannot decide through their own monitoring access. Request and enrollment locking protects against duplicate processing. The pending-state policy may return `403` before the controller's `409` conflict check.

Success stores `reviewed_by` and `date_reviewed`, records activity, and creates a student in-app decision notification. `approved`/`noted` excuse the request; `invalid` increments the attendance tracker. There is no remarks field in this endpoint's validation.

`PATCH /instructor/followups/{followupFlag}/resolve` takes no body, requires flag-update authorization, and returns the updated flag. Already resolved: `409`. Resolving a flag does not itself decide the associated request.
