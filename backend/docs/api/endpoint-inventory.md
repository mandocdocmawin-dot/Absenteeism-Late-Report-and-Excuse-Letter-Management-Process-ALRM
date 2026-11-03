# Endpoint inventory

[API documentation index](README.md)

**Access:** Public = no bearer token; Shared = Sanctum + active-account middleware; Student/Instructor/Head/Admin additionally require approved status and the appropriate role group. **Paged** refers to the pagination contract above. UUID route parameters use Laravel model binding where applicable.

## Public and shared endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/auth/google/redirect` | Public | Start Google OAuth; browser redirect |
| GET | `/auth/google/callback` | Public | Handle Google's callback; browser redirect |
| POST | `/auth/exchange` | Public | Exchange one-time code for bearer token |
| POST | `/auth/otp/check-trusted` | Public | Check pending login's trusted device |
| POST | `/auth/otp/verify` | Public | Verify OTP and issue exchange code |
| POST | `/auth/otp/resend` | Public | Resend OTP |
| POST | `/logout` | Shared | Revoke current token |
| GET | `/me` | Shared | Current user and program relations |
| PATCH | `/me/notification-preferences` | Shared | Change email notification preference |
| GET | `/complete-profile/programs` | Shared | Program choices excluding General Education |
| POST | `/complete-profile` | Shared | Complete student profile or link staff program |
| GET | `/notifications` | Shared | Own in-app notifications; **Paged** |
| GET | `/notifications/preview` | Shared | Latest 5 own in-app notifications and full inbox unread count |
| GET | `/notifications/unread-count` | Shared | Own unread in-app count |
| PATCH | `/notifications/read-all` | Shared | Mark own in-app notifications read |
| PATCH | `/notifications/{notification}/read` | Shared | Mark owned notification read |
| GET | `/requests/{request}/evidence` | Shared + ownership/scope policy | Stream protected attachment |

## Student endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/dashboard` | Student dashboard snapshot |
| GET | `/classes` | Enrolled classes with an existing instructor |
| POST | `/requests/evidence` | Upload evidence; `201` |
| POST | `/requests` | Submit request; `201` |
| GET | `/requests` | Own requests; **Paged** |
| GET | `/requests/{request}` | Own request with class and follow-up relation |
| PATCH | `/requests/{request}` | Edit own pending request |
| DELETE | `/requests/{request}` | Cancel own pending request; preserves record |
| POST | `/requests/{request}/follow-up` | Follow up own pending request; `201` |
| GET | `/attendance/summary` | Own enrollments and nullable attendance trackers |

## Instructor endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/instructor/requests/export` | Download scoped XLSX |
| GET | `/instructor/requests` | Requests for taught classes; **Paged** |
| PATCH | `/instructor/requests/{request}/decision` | Approve, note, or invalidate own class's request |
| GET | `/instructor/dashboard` | Class and attendance snapshot |
| GET | `/instructor/followups` | Open flags escalated to current instructor; **Paged** |
| PATCH | `/instructor/followups/{followupFlag}/resolve` | Resolve an authorized flag |

## Program-head endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/program-head/reports/export` | Download program-scoped activity/risk CSV |
| GET | `/program-head/audit-logs` | Scoped student/instructor activity; **Paged**; primary-role restriction applies |
| GET | `/program-head/dashboard` | Summary of headed programs |
| GET | `/program-head/students` | Students in headed programs; **Paged** |
| GET | `/program-head/instructors` | Instructors linked to or teaching in headed programs; **Paged** |
| GET | `/program-head/students/flagged` | Flags escalated to user OR belonging to headed programs; adds attendance `threshold` and `percentage`; **Paged** |
| PATCH | `/program-head/followup-flags/{followupFlag}/resolve` | Resolve an authorized flag and audit the action; 409 if already resolved |
| GET | `/program-head/requests` | Requests in headed programs; **Paged** |

## Administrator endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/audit-logs` | College-wide student/instructor request activity; **Paged** |
| GET | `/admin/dashboard` | College-wide dashboard |
| GET | `/admin/users` | User list and filters; **Paged** |
| POST | `/admin/users` | Pre-register institutional roster entry; `201` |
| DELETE | `/admin/users/{user}` | Delete pending/deactivated account |
| PATCH | `/admin/users/{user}/role` | Reassign eligible role |
| PATCH | `/admin/users/{user}/status` | Approve, deactivate, or reactivate |
| GET | `/admin/programs` | Program list; **Paged** |
| POST | `/admin/programs` | Create program; `201` |
| GET | `/admin/programs/{program}` | Program details and relations |
| PUT/PATCH | `/admin/programs/{program}` | Update program |
| DELETE | `/admin/programs/{program}` | Delete program with no classes/users/curriculum history |
| GET | `/admin/classes` | Class list; **Paged** |
| POST | `/admin/classes` | Create class and enroll matching students; `201` |
| GET | `/admin/classes/{class}` | Class, instructor, program, and enrolled students |
| PUT/PATCH | `/admin/classes/{class}` | Update class and enroll matching students |
| DELETE | `/admin/classes/{class}` | Delete class with no enrollments or assignment history |
| GET | `/admin/classes/{class}/assignments` | Teaching assignment versions and recent change events |
| POST | `/admin/classes/{class}/assignment` | Assign, replace, move, swap, or remove teaching assignment |
| GET | `/admin/classes/{class}/pending-requests` | Pending requests blocking an assignment change; **Paged** |
| GET | `/admin/curricula` | List curriculum revisions; optional program/version filters; **Paged** |
| POST | `/admin/curricula` | Add a curriculum revision; `201`, or `200` for an identical existing payload |
| GET | `/admin/curricula/{curriculum}` | Curriculum subjects, offerings, program, and sources |
| GET | `/admin/reports/export` | Download college-wide XLSX |
| GET | `/admin/reports/preview` | Preview export row count and date window |

`PUT/PATCH` denotes both registered resource update methods. There are no resource create/edit HTML routes. `/up` is a separate Laravel health route outside `/api`; `/` serves the welcome view.
