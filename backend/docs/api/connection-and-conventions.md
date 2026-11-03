# Connection and conventions

[API documentation index](README.md)

| Setting | Value |
|---|---|
| Local base URL | `http://localhost:8000/api` when using `php artisan serve` with its default port |
| Browser base URL | `/api` through the configured frontend proxy |
| Authentication | Laravel Sanctum bearer token |
| JSON headers | `Accept: application/json`, `Content-Type: application/json` |
| Upload content type | `multipart/form-data`; let the client set its boundary |
| Identifiers | UUID strings for users, programs, classes, requests, flags, attachments, and notifications |
| Date inputs | Prefer `YYYY-MM-DD`; some endpoints enforce this exact format |
| Success status | `200` unless marked `201` or a redirect below |

Every path in the inventory is relative to the base URL. For example, `/requests` means `/api/requests`. There is no `/v1` prefix. GET routes also support Laravel's normal HEAD handling.

Most JSON responses use:

```json
{
  "success": true,
  "message": null,
  "data": []
}
```

This is not a universal envelope. Notification-preference success omits `message`; framework validation/authentication/authorization errors can have different shapes. Evidence and report success responses contain binary file data. Google OAuth endpoints redirect the browser.

## Pagination

Endpoints marked **Paged** use `BoundedCollection`:

| Query | Validation | Default |
|---|---|---|
| `page` | Integer, 1–100000 | 1 when pagination is requested |
| `per_page` | Integer, 1–100 | 50 when pagination is requested |

Supplying either parameter enables pagination. `data` remains an array. The response adds `meta: {"page":1,"per_page":50,"total":120,"last_page":3}`. With neither parameter, `meta` is `null` and at most 500 records may be returned; a larger result produces `422` instead of silent truncation. Follow `meta.last_page` to retrieve all pages. Pagination parameters do not paginate dashboard snapshots, student classes, attendance summaries, or exports.
