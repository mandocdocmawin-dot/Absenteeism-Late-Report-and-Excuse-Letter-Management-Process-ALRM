# Student requests and evidence

[API documentation index](README.md)

## Upload first, then submit

`POST /requests/evidence` accepts one multipart field named `file`. Allowed extensions/MIME types: PDF (`application/pdf`), JPG/JPEG (`image/jpeg`), PNG (`image/png`). Contents and extension must agree. Maximum upload is 2048 KiB (2 MiB); empty/unreadable files are rejected. A student may have at most 10 unlinked uploads. PDF objects are parsed by qpdf 11+; actions, forms, embedded files, interactive media, encryption, malformed files and parser warnings are rejected. See [PDF evidence validator](../../app/Support/EvidencePdfValidator.php) for the validation implementation.

Images must be no larger than 8192 pixels on either side and 8,000,000 total pixels. They are re-encoded as JPEG, resized to a maximum 1600-pixel longest edge, with a white background. PDFs are checked for a `%PDF-` header.

Illustrative `201` response:

```json
{
  "success": true,
  "message": "File uploaded.",
  "data": {
    "path": "019a2d00-0000-7000-8000-000000000001",
    "name": "medical-certificate.jpg",
    "type": "image/jpeg"
  }
}
```

Despite its name, `data.path` is an attachment UUID. Submit it as `evidence_file_url`; do not send a public URL or filesystem path. The attachment must belong to the caller and still be unlinked. Linking is atomic; an attachment already claimed by another request is rejected.

## Create request

`POST /requests` accepts:

| Field | Required | Rules |
|---|---|---|
| `class_id` | Yes | Existing class UUID; caller must be enrolled; instructor must exist |
| `type` | Yes | `absence` or `late` |
| `subjects_missed` | Yes | String ≤255 |
| `minutes_late` | When `type=late` | Nullable integer, 1–999 when present |
| `start_date_of_absence` | Yes, for both types | Occurrence date, including late requests |
| `end_date_of_absence` | No | Nullable date on/after start |
| `reason` | Yes | String ≤600 on create |
| `evidence_file_url` | Yes | Required owned, unlinked attachment UUID |
| `evidence_type` | No | Nullable string ≤100 |
| `proof_types` | No | Nullable list, maximum 6 distinct allowed strings |
| `guardian_name` | Yes | String 2–60 characters, no digits |
| `contact_number` | Yes | Philippine number matching `09` + 9 digits or `+639` + 9 digits |

Allowed `proof_types` values, with exact spelling:

- `Medical Certificate`
- `Prescription / Medical Record`
- `Death Certificate / Funeral Notice`
- `School Activity Endorsement`
- `Letter from Parent/Guardian`
- `Others`

The backend derives enrollment and active teaching assignment from the caller and class. It saves an immutable `class_snapshot` containing subject, instructor, program, section, academic term, and timetable details, and records `teaching_assignment_id` and `snapshot_source: submission`. It sets status `pending` and submission time; it also updates the user's guardian/contact details. An equivalent submission within five minutes returns `409`; equivalence compares enrollment, type, reason, subjects, minutes late, start date, and end date. Clients should send the optional `teaching_assignment_id` returned by `GET /classes`; an ended/replaced ID returns `409`. Older clients that omit it resolve the current active assignment under a class lock. Snapshot input supplied by the client is ignored.

## Read, edit, cancel, follow up

`GET /requests` is scoped to the student and loads `enrollment.class`. `GET /requests/{request}` also loads `followupFlag`. The detail route is in the student group even though the shared evidence policy supports staff access.

`PATCH /requests/{request}` requires the full editable set: `type`, `subjects_missed`, `start_date_of_absence`, `reason`, and `minutes_late` when late. Optional fields are `end_date_of_absence`, `evidence_file_url`, `evidence_type`, and `proof_types`, with create rules except **reason is limited to 500 characters on update**. Class, enrollment, guardian, contact, and review fields are not editable here. Omit `evidence_file_url` or send its current value; changing/removing it is rejected with `422`.

Only the owner of a pending request may edit or cancel it. The policy generally rejects reviewed requests with `403`; update also contains a `422` reviewed-state check and a transactional `409` conflict check. Do not assume every state conflict has the same status.

`DELETE /requests/{request}` changes status to `cancelled`, returns the updated object, and preserves history. It does not hard-delete the row.

`POST /requests/{request}/follow-up` takes no body. It requires ownership, pending status, and an active instructor with an email address. A follow-up within 24 hours of the latest flag is rejected with `429`. Success creates an open flag, records activity, creates an in-app notification, and queues instructor mail through the delivery service. `201` confirms the recorded follow-up, not delivery to an email inbox.

## Read protected evidence

`GET /requests/{request}/evidence` streams the attachment as an inline PDF or image, with `Content-Type`, `Content-Disposition`, and `Cache-Control: private, no-store`. It is available to the owning student, class instructor, head of the class's program, or administrator according to the policy. Missing attachment: `404`. Fetch with a bearer header and consume the body as a blob; an ordinary image URL cannot supply that header.
