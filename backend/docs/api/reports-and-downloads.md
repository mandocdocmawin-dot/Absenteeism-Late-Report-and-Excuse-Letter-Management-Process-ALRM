# Reports and downloads

[API documentation index](README.md)

All exports are capped at 5,000 rows and throttled to 3/minute per user. A successful file download is not a JSON envelope. No PDF report-export endpoint is currently registered.

All report exports and the admin preview default to the saved current academic period. To retrieve history, supply both `semester=1st|2nd` and `school_year=YYYY-YYYY` (consecutive years), for example `?semester=1st&school_year=2025-2026`. Supplying only one field or invalid values returns `422`. Period filters match the enrollment's class and are combined with program, authorization, status, and date filters; a date range alone never switches academic periods. A valid period with no matching records returns an empty report. Historical reports may need an explicit date window because the existing 365-day default still applies.

| Endpoint | Format | Optional query filters | Date meaning |
|---|---|---|---|
| `/instructor/requests/export` | XLSX | `class_id` owned by instructor; `type=absence|late`; `status=pending|approved|noted|invalid|cancelled`; `search` student name ≤50 characters | No date filter/window implemented |
| `/program-head/reports/export` | UTF-8 CSV with BOM | `report_type=activity|risk` (default activity); `program_id` among headed programs; exact `date_from`, `date_to` in `YYYY-MM-DD` | Activity: submission time, falling back to created time. Risk: flag date |
| `/admin/reports/export` | XLSX | Existing `program_id`; `status=pending|approved|noted|invalid`; `date_from`, `date_to` valid dates | Occurrence date (`start_date_of_absence`) |
| `/admin/reports/preview` | JSON | Same filters as admin export | Same occurrence date window |

Head/admin date windows permit at most 730 days and include the end date. With no dates, they default to the preceding 365 days through today. With only `date_to`, start defaults to 365 days before it; with only `date_from`, end defaults to today. Instructor export has no 730-day date constraint. Narrow filters when exports exceed the row cap (`422`).

Head activity CSV columns: `Student`, `Class`, `Submitted`, `Type`. Risk CSV columns: `Student`, `Class`, `Flagged date`, `Threshold`, `Percentage`. Threshold and percentage come from the current enrollment attendance tracker using the backend semester-hours calculation, not a historical snapshot. Missing trackers produce blank values; zero semester hours produce a blank percentage. Risk export is restricted to headed programs even for flags escalated to the user from elsewhere. Resolve uses `PATCH /program-head/followup-flags/{id}/resolve`; see the endpoint inventory and response fields above.

Admin preview returns `data.row_count`, `exceeds_limit`, `max_export_rows`, `date_from`, `date_to`, `semester`, `school_year`, and `used_default_range`. Preview can report a count above 5,000; export rejects that count. Preview is useful before requesting a download but is not a server-enforced prerequisite.
