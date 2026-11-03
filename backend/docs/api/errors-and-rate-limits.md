# Errors and rate limits

[API documentation index](README.md)

| HTTP status | Typical meaning |
|---|---|
| `400` / `405` | Invalid request or unsupported method, as applicable |
| `401` | Missing/invalid/expired bearer token or invalid exchange code |
| `403` | Wrong role, unapproved account, ownership/scope denial, or blocked account |
| `404` | Missing bound record, missing evidence, or no pending OTP |
| `409` | Duplicate submission, immutable/completed profile, conflicting management action, already-resolved flag, or transaction state conflict |
| `410` | Expired pending login session |
| `413` | Request body exceeds infrastructure/PHP limits; may occur before Laravel |
| `422` | Validation error, unavailable business prerequisite, legacy list >500, export/date cap |
| `429` | HTTP throttle, OTP budget/resend cooldown, or follow-up cooldown |
| `500` | Unexpected server failure; custom handler returns a generic message |

Typical Laravel validation error:

```json
{
  "message": "The reason field is required.",
  "errors": {
    "reason": ["The reason field is required."]
  }
}
```

Business failures commonly return `{"success":false,"message":"…","data":null}`. The current wrong-role middleware response spells its flag **`succcss`**, so clients should use HTTP status rather than assume all errors contain `success`. Authentication/authorization/model-binding exceptions may use Laravel's default JSON shape. Read `errors` for field-level messages, and handle download errors as JSON before attempting to save a file.

| Budget | Limit |
|---|---|
| API-wide | 300/minute per IP plus 120/minute per authenticated user (IP fallback for guests) |
| All `/auth/*` routes | Additional 20/minute per IP |
| OTP/check-trusted | Additional 10/minute per IP and 10/minute per pending-token key |
| Student request creation | Additional 5/minute and 50/day per user |
| Evidence uploads | Additional route throttle 20/minute |
| Student follow-up | Additional route throttle 5/minute plus 24-hour business cooldown per request |
| Export routes | Additional 3/minute per user |

Limits are cumulative. Honor throttle `Retry-After` when supplied. OTP resend cooldown also returns `data.retry_after`; follow-up cooldown is reported through its message. Cache and proxy configuration affect production enforcement; these figures describe configured code, not measured live behavior.
