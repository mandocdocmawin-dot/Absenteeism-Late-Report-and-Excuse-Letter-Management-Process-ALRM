# Dashboards and program monitoring

[API documentation index](README.md)

| Endpoint | Main `data` fields and scope |
|---|---|
| `/dashboard` | `total_classes` for current term; `unexcused_absences`, `excused_absences`, `lates_recorded`, `pending_requests`, `threshold`, `subject_thresholds`, `unread_notifications`, up to 5 `recent_notifications` |
| `/classes` | Array: `enrollment_id`, `class_id`, `subject_name`, `section`, `schedule`, `semester`, `school_year`, enrollment `year_level`, `instructor: {id,name}`, program name; excludes classes with no existing instructor |
| `/attendance/summary` | Array: `class_id`, `subject_name`, nullable `tracker` for each own enrollment |
| `/instructor/dashboard` | `total_classes`, `total_students` (enrollment count across classes), full `pending_requests` and `flagged_students` arrays |
| `/program-head/dashboard` | Combined `program_name`, `total_students`, `total_instructors`, `total_classes`, `pending_requests`, `warning_count`, `critical_count`, `ir_count`, up to 5 `recent_flags` |
| `/admin/dashboard` | `total_programs`, `total_classes`, `total_students`, `total_instructors`, `total_program_heads`, `pending_staff_approvals`, `pending_requests`, `warning_count`, `critical_count`, `ir_count`, `open_followup_flags`, `programs_summary`, up to 10 `recent_flags` |

Dashboard class counts, attendance totals, thresholds, request counts, and flags use the saved current semester and school year. User-account counts, program counts, staff approvals, and notifications retain their existing account/program scope. `pending_staff_approvals` currently counts all pending users despite its field name.

`/classes`, `/attendance/summary`, `/program-head/requests`, and `/program-head/students/flagged` also default to the current academic period. Each supports historical access with both `semester=1st|2nd` and `school_year=YYYY-YYYY` (consecutive years); incomplete or invalid period filters return `422`. For example: `/attendance/summary?semester=1st&school_year=2025-2026`. Existing ownership/program rules still apply. Dashboards always show the current period.

Changing the saved academic period switches query results without changing existing classes, enrollments, requests, or trackers. The current-period enrollment rules used during profile completion and class creation/update remain in place; changing the period alone does not auto-enroll students into new classes. Student and instructor request-history lists and authorized individual-request access remain available across periods, including pending historical requests that still need review.

Student `threshold` is the **overall current-semester summary across every enrolled class**, including classes that have no attendance tracker yet. It is independent of any subject's IR status:

- `total_semester_hours`: sum of each enrolled class's `weekly_hours * semester_weeks`.
- `used`: sum of recorded missed contact hours plus `floor(total_lates / 3)` for each subject. Late remainders are not pooled across subjects. Missing trackers contribute zero used hours.
- `limit`: 20% of the combined semester hours, rounded to two decimals for display. Do not sum the old rounded per-class allowances.
- `absence_percentage`: `used / total_semester_hours * 100`, rounded to two decimals.
- `remaining_hours`: `max(0, exact overall allowance - used)`, rounded to two decimals.
- `remaining_semester_percentage`: `max(0, 20 - absence_percentage)` calculated before display rounding. Starts at 20 with enrolled hours and no absences.
- `status`: `safe`, `warning` at one combined week of hours, `critical` at two combined weeks, and `IR` at the exact overall 20% allowance. Subject IR does not force this overall status to IR.

With zero semester hours, percentages and allowance are zero and overall status is `safe`. If rendering a ring as `used / limit * 100`, label it **allowance used**. To show the actual overall absence percentage, use `absence_percentage` and label the limit as 20%.

`subject_thresholds` contains every enrolled subject: `class_id`, `subject_name`, actual recorded `absences`, `used_hours`, `total_semester_hours`, `absence_percentage`, `ir_absence_limit` (3), and `status`. Three or more recorded absence requests make that subject `IR` regardless of meeting length or the overall percentage. Existing hour-based warning/critical stages remain: one and two weeks of that class's hours. Three invalid lates contribute one hour; they do not count as three recorded absences toward subject IR. Approved, noted, and invalid absence requests count; pending/cancelled requests do not.

`/instructor/dashboard` uses subject status for `flagged_students` within the instructor's current-period classes. Each entry contains `student`, `class` (subject name), `class_id`, `status`, actual `absences`, separate legacy `converted_absences`, `used_hours`, `absence_percentage` (for that subject), and `ir_absence_limit`. A student can therefore have subject IR while their overall attendance remains safe. Program-head/admin tracker counts and alerts also refer to subject risk, not the aggregate student percentage.

Example: one 5-hour/week subject plus seven 3-hour/week subjects over 16 weeks gives 416 semester hours and an 83.2-hour overall allowance. Three missed meetings of 3h + 2h + 3h in the first subject give 8 used hours: overall absence is 1.92%, overall status is safe, but that subject is IR at 3 absences and its own absence percentage is 10%.

The migration `2026_11_06_000002_recompute_subject_ir_statuses` recomputes existing derived tracker statuses when deployed. It does not send alerts or reset notification timestamps; the existing automation delivers newly applicable stages once. `php artisan alrm:recompute-trackers` is also available for manual recomputation. Legacy absence counters remain one count per decided absence request; a multi-day request uses actual scheduled hours across its inclusive dates but does not become multiple absence-counter entries.

Program-head students, instructors, requests, dashboard, and report export require headed programs. Requests optionally filter `status` by `pending`, `approved`, `noted`, or `invalid`; unfiltered lists may also contain cancelled requests. Flagged-student lists optionally filter `status=open|resolved` and include flags escalated directly to the caller OR belonging to their headed programs. This flag-list scope is broader than report-export scope, which always uses headed programs.
