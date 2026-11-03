# Audit logs

[API documentation index](README.md)

`GET /admin/audit-logs` and `GET /program-head/audit-logs` share the controller and pagination. They expose supported student/instructor request and follow-up activity, not every row in the audit table or administrator management history.

| Query | Rules |
|---|---|
| `role` | `student` or `instructor` |
| `action` | One of the supported actions below |
| `user_id` | Actor UUID |
| `request_id` | Related request UUID |
| `from`, `to` | Exact `YYYY-MM-DD`; `to` on/after `from`; inclusive end day |
| `page`, `per_page` | Shared pagination rules |

Supported actions: `submitted_request`, `updated_request`, `cancelled_request`, `followed_up_request`, `decided_request_approved`, `decided_request_noted`, `decided_request_invalid`, `resolved_followup_flag`.

Primary-role administrators see eligible activity college-wide. Primary-role program heads see activity in their headed programs and need at least one assignment. Instructor primary-role accounts are rejected by this controller even when program-head middleware permits entry.

Items contain `id`, `action`, human-readable `description`, ISO-8601 `timestamp`, `actor: {id,name,role}`, `table_affected`, `record_id`, and a related `request` summary with `id`, `type`, `current_status`, `student: {id,name}`, and `class: {id,subject_name,program_id,instructor_id}`. `current_status` is the request's present state, not a historical snapshot at the event time. Results sort newest timestamp, then descending ID.
