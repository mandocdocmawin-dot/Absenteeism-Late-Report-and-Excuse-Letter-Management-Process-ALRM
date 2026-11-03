# Program-head and test-data maintenance

[API documentation index](README.md)

Google Sheets roster/schedule imports and the standalone bulk term-enrollment
sync have been removed. Default database seeding uses local program/catalog and
account definitions, followed by the existing development-class seeder; it does
not fetch a remote roster or timetable. Manage accounts and classes through the
administrator APIs. Normal enrollment during profile completion and class
creation remains available for request routing. Existing stored records are
not deleted by this removal.

Primary heads use `programs.program_head_id`; explicit co-heads use
`program_head_assignments`. A `program_head` role also grants access to the
account's current `users.program_id`. Teaching membership alone grants no head
access. To add explicit co-heads without replacing the primary head:

```sh
php artisan alrm:assign-program-heads PROGRAM_UUID USER_UUID [USER_UUID ...]
```

After an intentional attendance-policy change, recompute statuses with
`php artisan alrm:recompute-trackers`, then process outstanding stages with
`php artisan alrm:process-automation`. Avoid `--reset-notified` unless replaying
historical alerts is intentional. These commands can send notifications through
the existing worker and should be run as deliberate operational actions.

`DevInstructorScheduleSeeder` is optional sample data, separate from the academic
catalog and default seeding. It fills only empty schedules for the four
designated test-instructor accounts. It does not establish institutional meeting
times. Use `php artisan db:seed --class=DevInstructorScheduleSeeder` only when
test schedules are wanted. `DevInstructorClassSeeder` preserves existing
same-subject schedules when no nonempty official source schedule is available.

The student-domain instructor allowlist is defined by
`User::STUDENT_INSTRUCTOR_EMAILS`. To audit unexpected student-domain instructors,
use `php artisan alrm:repair-student-instructors`. The `--apply` option changes
accounts, revokes tokens/trusted devices, and records repairs; dependencies such
as teaching classes, memberships, or head assignments must be reviewed first.
