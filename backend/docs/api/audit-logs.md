# Audit logs

[API documentation index](README.md)

`GET /admin/audit-logs` and `GET /program-head/audit-logs` share the controller and pagination. They expose supported student/instructor request and follow-up activity plus automatic flag events, not every row in the audit table or administrator management history.

| Query | Rules |
|---|---|
| `role` | `student` or `instructor` |
| `action` | One of the supported actions below; `Flagged` is an accepted alias for `flagged_request` |
| `user_id` | Actor UUID |
| `request_id` | Related request UUID |
| `from`, `to` | Exact `YYYY-MM-DD`; `to` on/after `from`; inclusive end day |
| `page`, `per_page` | Shared pagination rules |

Supported actions: `submitted_request`, `updated_request`, `cancelled_request`, `followed_up_request`, `flagged_request`, `decided_request_approved`, `decided_request_noted`, `decided_request_invalid`, `resolved_followup_flag`.

`flagged_request` is recorded once when the backend creates a new automatic follow-up flag, either for an overdue pending request or an attendance consultation threshold. Repeated automation runs and threshold changes that reuse the same flag do not add another event. This is distinct from a student's `followed_up_request` and a reviewer's `resolved_followup_flag`. Responses always use the canonical `action=flagged_request` and `description=Flagged`, even when the filter uses `action=Flagged`. The short description also supports existing frontend action-label fallbacks.

Automatic flag events have `actor: null` (system activity). They appear in unfiltered or `Flagged` activity feeds within the viewer's existing program/request/class scope; human `role` and `user_id` filters exclude them. They do not send extra activity notifications: the existing flag/threshold alerts still handle delivery. Existing flags are not backfilled into audit events.

Deployments must run `php artisan migrate --force` to apply `2026_11_06_000001_allow_system_audit_logs.php` before using the new event producers. This migration permits a null audit actor without changing existing human audit rows. Rollback refuses to make the actor mandatory while system events exist, preserving recorded history.

Primary-role administrators see eligible activity college-wide. Primary-role program heads see activity in their headed programs and need at least one assignment. Instructor primary-role accounts are rejected by this controller even when program-head middleware permits entry.

Items contain `id`, `action`, human-readable `description`, ISO-8601 `timestamp`, `actor: {id,name,role}`, `table_affected`, `record_id`, and a related `request` summary with `id`, `type`, `current_status`, `student: {id,name}`, and `class: {id,subject_name,program_id,instructor_id}`. `current_status` is the request's present state, not a historical snapshot at the event time. Results sort newest timestamp, then descending ID.
