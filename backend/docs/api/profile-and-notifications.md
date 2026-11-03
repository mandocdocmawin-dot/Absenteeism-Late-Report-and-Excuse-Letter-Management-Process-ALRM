# Profile and notifications

[API documentation index](README.md)

## Complete profile

`POST /complete-profile` uses the server-side role; clients cannot set `role` or `status` here.

| Field | Rules |
|---|---|
| `program_id` | Existing program UUID; students may omit an already assigned value; staff must supply it |
| `school_id_number` | Required student profile value; may be omitted when already assigned. Otherwise nullable; string ≤50; unique except current user |
| `year_level` | Required student profile value; may be omitted when already assigned. Otherwise nullable; `1st`, `2nd`, `3rd`, `4th` |
| `role`, `status` | Prohibited |

Students receive profile fields and automatic enrollment into matching program/year classes for the current semester and school year. A student receives `409` only when program, school ID, and year are all already set. Missing fields can be completed without resubmitting assigned values; assigned student values cannot be changed or cleared. Staff save `school_id_number` when supplied and link the supplied program through the many-to-many relation without detaching existing programs. Omitting the staff ID preserves its existing value. Success returns a user resource.

`school_id_number` is the shared institutional ID for students, instructors, program heads, and administrators. Keep it as a string to preserve leading zeros and hyphens; it is unique across all users. The internal UUID `id` remains the relationship key. Staff IDs remain optional while staff onboarding is being built; student IDs remain required.

Staff pre-dashboard forms can submit to the same endpoint:

```json
{
  "program_id": "<program UUID>",
  "school_id_number": "EMP-00123"
}
```

Use `data.school_id_number` in the completion response and `/me` response. `year_level` is required only for students. The consolidated users migration creates `school_id_number` directly with a unique index. API clients must use the new field name.

`GET /complete-profile/programs` returns `data: [{id, program_name}]`, ordered by name, excluding `General Education`.

## Email preference

`PATCH /me/notification-preferences` requires `email_notifications_enabled` as a boolean. Response: `{"success":true,"data":{"email_notifications_enabled":false}}`. This controls optional email notifications; consult [Mail delivery and operations](mail-delivery-and-operations.md) for delivery behavior. It does not disable in-app notifications or authentication OTP.

## Notification operations

`GET /notifications?unread=1&page=1&per_page=50` lists the caller's in-app notifications newest by `date_sent`. The boolean `unread` filter is optional. Count success is `data: {"unread_count":3}`.

`GET /notifications/preview` is the bounded bell endpoint. It returns `data: {"notifications":[...],"unread_count":3}`: at most 5 own in-app notifications, newest by `date_sent` then descending `id` for ties, and the unread count across all own in-app notifications (including those outside the preview). An empty inbox returns `notifications: []` and `unread_count: 0`. It does not mark notifications read, load requests, or paginate/count the full list. The existing list and unread-count endpoints retain their contracts. Frontend callers must explicitly switch to this endpoint to use the preview.

Both read endpoints take no body. Marking an already-read notification read succeeds. A single-record operation checks ownership; read-all is scoped to the caller's unread in-app records and returns `data: null` with a count in `message`.
