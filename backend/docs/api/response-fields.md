# Response fields

[API documentation index](README.md)

| Object | Fields and notes |
|---|---|
| User resource | `id`, `name`, `email`, `role`, `program_id`, `school_id_number`, `status`, `year_level`, `heads_program`, `headed_program_exists`; `program`/`programs` only when loaded |
| Private user fields | `guardian_name`, `contact_number` in self, authenticated-exchange, or explicit admin resource context; `email_notifications_enabled` only for self/exchange. Resource rules do not imply that every nested user model has the same shape |
| Request model | UUID `id`, `enrollment_id`, `type`, `subjects_missed`, `minutes_late`, occurrence dates, `reason`, nullable evidence fields, `proof_types`, status, submission/review timestamps, `reviewed_by`, normal model timestamps; relations depend on endpoint |
| Follow-up flag | `id`, `request_id`, `flagged_date`, `escalated_to`, `status`; related request/student/class when loaded |
| Notification | `id`, `user_id`, nullable `request_id`, `type`, `message`, `channel`, `date_sent`, `is_read`; dashboard recent-notification summaries expose fewer fields |
| Tracker | `id`, `enrollment_id`, `total_lates`, `total_absences`, `converted_absences`, `status`, notification timestamps and normal model timestamps |

IDs in example requests must be replaced with records accessible to the authenticated caller. Do not rely on internal Google identity fields being present. Nullable dates/relations must be handled by clients.
