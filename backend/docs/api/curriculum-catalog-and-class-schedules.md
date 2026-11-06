# Curriculum catalog and class schedules

[API documentation index](README.md)

## Seed the supplied sources

The checked-in academic catalog is portable and needs no Google account, network
download, Excel installation, or source-folder access at seed time.

```sh
php artisan migrate
php artisan db:seed --class=AcademicCatalogSeeder
```

This seeds six programs, ten curriculum versions, 603 curriculum subject entries,
and 184 master-list subject offerings. Repeating the seed retains the same IDs
and counts. It creates no user accounts, student names, personal IDs, classes,
or enrollments. `DatabaseSeeder` also calls it after `ProgramSeeder`, but still
has its existing network-dependent instructor/class seeders; use the dedicated
command above to import only this catalog.

The seeder reads `database/seeders/data/academic_catalog.json` directly. The Python
builder and redundant transcription file are not needed and have been removed.
To publish an updated curriculum, submit a complete new revision through the
administrator curriculum API. To update the portable baseline seed, edit the
reviewed catalog JSON and update its source notes/fingerprints, then run
`AcademicCatalogSeeder` again. Existing revisions and class assignments remain.
The master-list import used only academic headers, excluding student rows and
student-name/status columns.

## Curriculum changes

`curricula` identifies program + curriculum year/version + content revision.
`curriculum_subjects` stores year, semester, code, title, and academic units.
`program_offerings` independently preserves the master list's academic-year
offerings. Differences between the two sources do not silently overwrite either.

A changed snapshot creates a new revision. Existing classes retain their
`curriculum_subject_id`, copied academic units, schedule, and contact hours.
Seeding never automatically chooses a latest version, reassigns a student,
rewrites a class, or changes attendance history. There is no edit/delete API for
existing revisions: corrections are submitted as a complete new revision.

Administrator-only endpoints use the existing auth/active/role middleware and
the registered `CurriculumPolicy`:

- `GET /api/admin/curricula?program_id=UUID&version=2025-2026`: list revisions.
- `GET /api/admin/curricula/{id}`: subjects, offerings, and provenance.
- `POST /api/admin/curricula`: add a complete revision. Identical repeated payloads
  return the existing revision. Duplicate codes within one year/semester are rejected.

Example creation body:

```json
{
  "program_id": "EXISTING_PROGRAM_UUID",
  "version": "2027-2028",
  "sources": [{"file": "approved-curriculum-2027.pdf"}],
  "subjects": [{
    "year_level": "1st", "semester": "1st", "code": "CC 1",
    "subject_name": "Introduction to Computing", "credit_units": 3,
    "lecture_units": 3, "laboratory_units": 0,
    "source": {"file": "approved-curriculum-2027.pdf", "page": 2}
  }]
}
```

## Create a class with or without meeting times

`POST /api/admin/classes` and `PATCH /api/admin/classes/{id}` accept structured
`schedule` entries. Each entry has `day` (`Mon` through `Sun`), `start`, `end`
(`HH:mm`, local college time), and optional `room`. Meetings must end after they
start on the same day and cannot overlap within that class.

```json
{
  "subject_name": "Computer Programming 1",
  "section": "BSIS 1",
  "program_id": "EXISTING_PROGRAM_UUID",
  "curriculum_subject_id": "SELECTED_VERSION_SUBJECT_UUID",
  "year_level": "1st", "semester": "1st", "school_year": "2026-2027",
  "schedule": [
    {"day": "Mon", "start": "08:00", "end": "10:00", "room": "Lab 1"},
    {"day": "Thu", "start": "13:00", "end": "14:00", "room": "Lab 1"}
  ]
}
```

`instructor_id` is optional until an instructor is assigned. A linked curriculum
subject must match the class's program, year level, and semester; its academic
units are copied to the class. No meeting time is inferred from the curriculum.

For an unscheduled class, omit `schedule` (stored as `[]`) and supply confirmed
`weekly_hours` and `meetings_per_week`. For example, `5` hours and `2` meetings.
The admin can add the actual times later through PATCH. Fractional weekly hours
are supported. Legacy free-text schedules are still accepted, with confirmed
hours/count required when creating a class because text cannot be reliably parsed.

When structured times are present, weekly hours and meeting count are derived
from them. Conflicting explicit values are rejected. Schedule edits recompute
existing attendance tracker statuses transactionally. No new alerts are sent by
the class update itself; the existing attendance automation handles notifications.

## Attendance thresholds

Academic units and lecture/lab units are catalog data, **not** contact hours.
No lecture/laboratory conversion multiplier is assumed. Subject warning and
critical stages remain based on one and two weeks of contact hours. Subject IR
is reached at three recorded absences, independently of hours. The student's
overall 20% allowance uses the combined semester contact hours of all enrolled
subjects. Three invalid lates still contribute one hour to missed hours; they
do not count as three absences for subject IR. See
[dashboards and program monitoring](dashboards-and-program-monitoring.md).

All decided absence requests (`approved`, `noted`, or `invalid`) count toward
attendance thresholds. Valid lates do not count; only invalid late requests
increment the late counter. Pending requests do not count.

Newly decided absence requests use the scheduled hours on their actual
occurrence date or inclusive date range, including unequal meeting lengths.
For example, missing the Monday meeting above adds two absent hours; Thursday
adds one. Those hours are stored in `attendance_tracker.absence_hours` so a later
schedule edit cannot change hours already recorded. Dates without a scheduled
meeting add zero hours. Holidays and individual cancellations are not represented
by this weekly schedule model.

Legacy trackers without recorded hours keep their previous count-times-average
calculation. Their accumulated estimate is retained when the next absence is
recorded. Unscheduled/free-text classes also use weekly hours divided by meeting
count, since actual meeting dates/times are unavailable.

## Source differences retained for review

- The BSSW endorsement letter says 2022-2023; its curriculum table and current
  master lists say 2023-2024. The catalog uses the curriculum table's label.
- Parenthesized and negative unit annotations are preserved in `units_text`.
  Numeric magnitudes are stored separately; they do not establish grading or
  institutional credit-counting rules and never set contact hours.
- BSAIS 2023-2024 PATH FIT 2 prints three units; the scan is retained as printed.
- BSIS 2018-2019 prints three units for PE 1 and two for NSTP 1; these are not
  silently normalized to the usual values.
- Master-list typos, renamed subjects/electives, and subjects from other years'
  curricula remain in the independent offerings with their source notes. They
  are not used to auto-enroll students or automatically create class sections.
- Supplemental ACT/BSIS professional-elective option lists are stored with the
  curriculum's source metadata; they do not automatically choose an elective.

No frontend admin form exists in this repository's current `front-end` app;
these are backend endpoints and seeders for the form to call.
