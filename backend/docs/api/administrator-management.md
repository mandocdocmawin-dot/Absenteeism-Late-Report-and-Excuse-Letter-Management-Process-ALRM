# Administrator management

[API documentation index](README.md)

## Users

| Operation | Inputs and behavior |
|---|---|
| List | Optional `role=student|instructor|program_head|administrator`, `status=pending|approved|deactivated|inactive`, plus pagination. `inactive` maps to `deactivated`. Users with null roles are excluded; results ordered by name |
| Pre-register | Required `name` string ≤255, or first/last names plus optional middle name combined into `name`; unique email ≤255, trimmed and lowercased; `role` from the list above. Optional existing program UUID and unique `school_id_number` string ≤50. Student domain requires student role; staff domain requires a staff role. Creates pending roster entry; no password input. Year is collected through profile completion |
| Change role | Required `role=instructor|program_head|administrator`. Existing student may only be promoted to `program_head`; null-role targets are rejected. Pending external accounts may instead receive any of the four roles, including student. Cannot change own role; unchanged role gives `409`. This operation does not approve pending users |
| Change status | Required `status=approved|deactivated|inactive`; inactive is stored as deactivated. Cannot change own status. Pending user without a Google identity cannot be changed here (`409`); pending self-registered user may only be approved. Repeating current status gives `409` |
| Delete | Only pending or deactivated account; active account gives `409`. Returns `data: null` |

Status deactivation deletes bearer tokens and trusted-device records. During pre-registration, a supplied program is stored directly for students, linked through `program_user` for instructors, and assigned through `programs.program_head_id` for Program Heads. An occupied head assignment is rejected. Administrators cannot receive a program through pre-registration. A role change alone does not create an explicit head assignment. User creation, program assignment, and audit logging run in one transaction. Lists and creation responses include both direct `program` and teaching-membership `programs` relationships. The first institutional Google sign-in uses Google's name while retaining assigned role, school ID, and program relationships.

## Programs

Create requires unique `program_name` string ≤255. Optional nullable `program_head_id` must be an existing UUID for a user with primary role `instructor` or `program_head`. Update accepts either field optionally (`sometimes`). `null` can clear the head assignment. Lists load `programHead` plus class/user counts; details load `programHead`, `classes`, and `users`.

Delete returns `409` when classes, users, or curriculum history remain; success returns `data: null`.

## Classes

Required on create: subject name, section, program, year level, semester, and school year. These are optional on PUT/PATCH update. Other fields follow the rules below:

| Field | Validation |
|---|---|
| `subject_name` | String ≤255 |
| `section` | String ≤50 |
| `instructor_id` | Create only: optional nullable UUID of an approved instructor. Must be omitted on update; use the assignment endpoint |
| `schedule` | Optional structured meeting array; legacy string ≤4096 accepted. Omitted times require confirmed hours/count on creation |
| `program_id` | Existing program UUID |
| `year_level` | `1st`, `2nd`, `3rd`, `4th` |
| `semester` | `1st`, `2nd` |
| `school_year` | String matching `YYYY-YYYY` |
| `curriculum_subject_id` | Optional nullable existing subject UUID matching class program, year, and semester |
| `credit_units` | Optional nullable numeric 0–100; copied from the selected curriculum subject when linked |
| `weekly_hours` | Positive numeric ≤168, including fractions; derived when structured meeting times are supplied |
| `meetings_per_week` | Integer 1–42; derived when structured meeting times are supplied |

Create/update auto-enroll matching students only when the class belongs to the current semester and school year. It creates missing enrollments; it does not detach existing ones. Writes and audit logging run transactionally; class updates also recompute existing tracker statuses. Lists load instructor/program, `active_teaching_assignment`, `assignment_revision`, enrollment count, and `pending_requests_count`. Class identity changes (subject, curriculum subject, program, section, year, semester, school year) return `409` once any enrollment or assignment history exists. Create/select another class and change its teaching assignment instead. Delete with any enrollments or assignment history returns `409`; success returns `data: null`. See [TeachingAssignmentService](../../app/Services/TeachingAssignmentService.php) for the assignment implementation, and [Curriculum catalog and class schedules](curriculum-catalog-and-class-schedules.md) for schedule payloads and attendance-hour behavior.
