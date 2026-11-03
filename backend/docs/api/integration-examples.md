# Integration examples

[API documentation index](README.md)

## Submit an absence request

After browser OAuth/OTP/exchange, a client can send:

```http
POST /api/requests HTTP/1.1
Authorization: Bearer <token-from-auth-exchange>
Accept: application/json
Content-Type: application/json

{
  "class_id": "019a2d00-0000-7000-8000-000000000002",
  "type": "absence",
  "subjects_missed": "Software Engineering",
  "start_date_of_absence": "2026-10-29",
  "reason": "Medical appointment",
  "proof_types": ["Medical Certificate"],
  "guardian_name": "Maria Santos",
  "contact_number": "09171234567"
}
```

For a late request, set `type` to `late` and include `minutes_late`; retain the required occurrence date. Evidence is required for both request types: upload it first and include its attachment UUID as `evidence_file_url`.

## Paginated authenticated request

```javascript
const response = await fetch('/api/requests?page=1&per_page=50', {
  headers: {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  },
  credentials: 'include',
});
const payload = await response.json();
if (!response.ok) throw new Error(payload.message ?? `HTTP ${response.status}`);
const requests = payload.data;
const lastPage = payload.meta.last_page;
```

## Multipart evidence upload

```javascript
const body = new FormData();
body.append('file', selectedFile);
const response = await fetch('/api/requests/evidence', {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  },
  credentials: 'include',
  body,
});
const payload = await response.json();
if (!response.ok) throw new Error(payload.message ?? 'Upload failed');
const evidenceAttachmentId = payload.data.path;
```

## Instructor decision

```http
PATCH /api/instructor/requests/019a2d00-0000-7000-8000-000000000003/decision HTTP/1.1
Authorization: Bearer <instructor-token>
Accept: application/json
Content-Type: application/json

{"status":"noted"}
```

## Download a report

```javascript
const response = await fetch('/api/admin/reports/export?date_from=2026-10-01&date_to=2026-10-29', {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
});
if (!response.ok) {
  const payload = await response.json();
  throw new Error(payload.message ?? 'Export failed');
}
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'alrm-requests.xlsx';
document.body.append(link);
link.click();
link.remove();
setTimeout(() => URL.revokeObjectURL(url), 1000);
```
