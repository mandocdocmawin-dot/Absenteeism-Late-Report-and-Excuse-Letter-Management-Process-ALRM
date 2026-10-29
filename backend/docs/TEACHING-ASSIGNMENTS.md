# Teaching assignments and request history

Classes identify the subject offering, program, section and academic term.
`teaching_assignments` keeps instructor assignment versions. An assignment is
active while `ended_at` is null. Database constraints allow one active assignment
per class and unique `(class_id, version)` values. `classes.instructor_id` is a
compatibility mirror maintained by the assignment service in the same transaction.

## Request snapshots

Submission locks the class, resolves its active assignment and saves
`teaching_assignment_id`, `snapshot_source: submission` and immutable JSON
`class_snapshot`. The snapshot contains subject, instructor ID/name, program
ID/name, section, year, academic term, curriculum subject, schedule, contact hours,
meeting count and credit units. Student input cannot supply the snapshot.
`subjects_missed` remains a separate editable field.

Request responses populate the existing `enrollment.class` object from the
snapshot. Exports and request emails also use historical values. Original
instructors retain read access to their historical requests; replacements do not
inherit those requests. Decisions require ownership of an active assignment.

## Administrator endpoints

These endpoints require an authenticated, approved administrator:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/admin/classes?page=1&per_page=50` | Rows with `assignment_revision`, `active_teaching_assignment` and `pending_requests_count` |
| GET | `/api/admin/classes/{id}/assignments` | Assignment versions and 100 recent change events involving the class |
| GET | `/api/admin/classes/{id}/pending-requests?page=1&per_page=50` | Requests blocking a change |
| POST | `/api/admin/classes/{id}/assignment` | Perform an assignment operation |

Every operation requires `action`, `expected_revision` from the displayed source
class, and a `reason` string of up to 1,000 characters.

| Action | Additional fields | Behavior |
| --- | --- | --- |
| `assign` | `instructor_id` | Assign an approved instructor to an unassigned class |
| `change_instructor` | `instructor_id` | End the current assignment and create its replacement |
| `change_subject` | `target_class_id`, `target_expected_revision` | Move the instructor to an unassigned class; leave the source unassigned |
| `swap` | `target_class_id`, `target_expected_revision` | Exchange instructors between two assigned classes |
| `remove` | None | End the assignment; preserve the class, enrollments and requests |

Example removal:

```json
{
  "action": "remove",
  "expected_revision": 1,
  "reason": "Teaching load adjustment"
}
```

Moves and swaps require matching semester and school year. An occupied destination
requires a swap. Students are never transferred by an assignment operation. If a
destination offering does not exist, create an unassigned class first using the
normal class creation endpoint and its current-term enrollment rules.

Any pending request in either affected class blocks the operation with `409`.
Requests must first be reviewed by their existing instructor or cancelled by
their student owner. Stale source or target revisions also return `409`.
Submissions and assignment operations lock the same class rows. Swaps lock classes
in ID order, close both originals before inserting replacements, and roll back
everything on failure. One audit event records actor/time, reason, event ID and
before/after assignment IDs, versions, instructor names, subjects and sections.

Success returns `data.event_id` and `data.classes`, containing updated class
objects with their new revisions and active assignments.

Ordinary class PUT/PATCH must omit `instructor_id`, including null. Class identity
fields cannot change once enrollments or assignment history exist. Schedule and
contact-hour edits remain available. Class deletion with enrollment or assignment
history returns `409`; account deletion with enrollment or teaching history also
returns `409`. Foreign keys independently restrict deletion of referenced records.

## Frontend integration

The admin screen supplied in the screenshots is not in this repository; the local
frontend contains the login view. Apply these steps to that actual admin screen:

1. Read assignment rows and revisions from `/admin/classes`; follow pagination.
2. Use **Change assignment** for instructor replacement, subject/class changes and
   swaps. Program/year/semester dropdowns filter destination classes; they do not
   modify the original class identity.
3. Show both original and proposed assignments before confirming. Require a reason.
4. Replace **Remove class** with **Remove assignment** for teaching-load removal.
   Explain that the class, students and request history remain. Send `action:
   remove` to the assignment endpoint rather than deleting the class.
5. Disable saving when pending requests exist and link to the pending list. Still
   handle server `409` because submissions or edits can arrive after loading.
6. Send displayed source/target revisions, disable duplicate clicks during saving,
   and refresh affected rows after success. On stale revisions, show the refreshed
   state for review rather than silently retrying the operation.
7. Show unassigned classes in Manage classes with an **Assign instructor** action.
8. Student submissions should include `teaching_assignment_id` from `GET
   /api/classes`. Ended/replaced IDs return `409`. Older clients may omit this field
   and resolve the current assignment under a class lock.
9. Display request history from `class_snapshot` or the historical
   `enrollment.class` response, rather than joining current instructor/class lists.

## Migration and verification

Apply `2026_10_30_000001_version_teaching_assignments.php` with the backend changes
before connecting the new frontend. It creates baseline assignments and backfills
existing request snapshots. Baseline start times are migration time. Existing
snapshots are marked `legacy_backfill`: they reflect available migration-time
data, not a verified reconstruction of the instructor at original submission.
Legacy unassigned classes retain null assignment/instructor values. Resolve or
cancel legacy pending requests before assigning those classes.

Tests use isolated in-memory SQLite. The configured application database has not
been migrated by the implementation task. Verify migration and simultaneous
sessions against the production MySQL/TiDB engine in staging before rollout.
Injected swap failures test transaction rollback; they do not simulate an actual
production network disconnect.

Run the suite from `backend` in PowerShell:

```powershell
$env:APP_ENV = 'testing'
$env:DB_CONNECTION = 'sqlite'
$env:DB_DATABASE = ':memory:'
$env:CACHE_STORE = 'array'
$env:SESSION_DRIVER = 'array'
$env:QUEUE_CONNECTION = 'sync'
php -d memory_limit=768M vendor/bin/phpunit --bootstrap vendor/autoload.php tests
```

The implementation validation passed 213 tests (2,437 assertions) and Pint checks.
