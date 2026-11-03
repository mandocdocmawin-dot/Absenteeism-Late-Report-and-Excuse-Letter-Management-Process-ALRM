# Dashboards and program monitoring

[API documentation index](README.md)

| Endpoint | Main `data` fields and scope |
|---|---|
| `/dashboard` | `total_classes` for current term; `unexcused_absences`, `excused_absences`, `lates_recorded`, `pending_requests`, `threshold`, `unread_notifications`, up to 5 `recent_notifications` |
| `/classes` | Array: `enrollment_id`, `class_id`, `subject_name`, `section`, `schedule`, `semester`, `school_year`, enrollment `year_level`, `instructor: {id,name}`, program name; excludes classes with no existing instructor |
| `/attendance/summary` | Array: `class_id`, `subject_name`, nullable `tracker` for each own enrollment |
| `/instructor/dashboard` | `total_classes`, `total_students` (enrollment count across classes), full `pending_requests` and `flagged_students` arrays |
| `/program-head/dashboard` | Combined `program_name`, `total_students`, `total_instructors`, `total_classes`, `pending_requests`, `warning_count`, `critical_count`, `ir_count`, up to 5 `recent_flags` |
| `/admin/dashboard` | `total_programs`, `total_classes`, `total_students`, `total_instructors`, `total_program_heads`, `pending_staff_approvals`, `pending_requests`, `warning_count`, `critical_count`, `ir_count`, `open_followup_flags`, `programs_summary`, up to 10 `recent_flags` |

`pending_staff_approvals` currently counts all pending users despite its field name. Most dashboard aggregate queries are not restricted to the current academic term; only the student `total_classes` calculation explicitly is.

Student `threshold` contains `used`, `limit`, `status`, and `remaining_semester_percentage`. The closest class is selected by usage ratio; overall status is the highest severity among trackers. These values need not describe the same tracker.

Attendance status values are `safe`, `warning`, `critical`, and uppercase `IR`. The current policy uses class meeting hours: `used = total_absences × unitsPerMeeting + floor(total_lates / 3)`. Warning and critical correspond to one and two weeks of class hours; IR is the allowable absence-hours limit, based on 20% of semester hours rounded up to a whole hour for every subject. `converted_absences` separately equals `total_absences + floor(total_lates / 3)`. Do not implement a fixed 2/3-absence threshold from the older README/report; see `AttendanceTracker` and `ClassModel`.

Program-head students, instructors, requests, dashboard, and report export require headed programs. Requests optionally filter `status` by `pending`, `approved`, `noted`, or `invalid`; unfiltered lists may also contain cancelled requests. Flagged-student lists optionally filter `status=open|resolved` and include flags escalated directly to the caller OR belonging to their headed programs. This flag-list scope is broader than report-export scope, which always uses headed programs.
