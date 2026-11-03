# Authentication and account access

[API documentation index](README.md)

## Browser login sequence

1. Navigate to `/api/auth/google/redirect?origin=<frontend-origin>`. The optional origin is matched against configured frontend origins; an unrecognized/missing origin falls back to the first configured origin. `origin` is a string of at most 2048 characters.
2. The server sets the HttpOnly `alrm_oauth` cookie and redirects to Google. OAuth state is browser-bound, single-use, and expires after 10 minutes. Start redirect and callback through the same frontend origin/proxy so the cookie returns.
3. Google redirects to `/api/auth/google/callback` with its `code` and encrypted `state`. This endpoint is provider-driven; do not manufacture those values. The callback validates verified email and stable Google identity.
4. An untrusted device is redirected to `<frontend>/auth/otp?user_id=<uuid>&pending=<40-character-token>&checked=1`. The pending login session lasts 10 minutes. An OTP is emailed and lasts 5 minutes.
5. Submit `/auth/otp/verify`. Its success response contains `data.exchange_code` and sets an HttpOnly `alrm_device` cookie lasting 60 days. Successful OTP verification revokes the user's existing bearer tokens.
6. Submit `/auth/exchange` with that code within 60 seconds. It is single-use and returns `data.token` plus `data.user`.
7. Send `Authorization: Bearer <token>` on protected calls.

A trusted device can bypass OTP: the callback redirects to `<frontend>/auth/otp?exchange_code=<code>`. `/auth/otp/check-trusted` is a fallback for a pending login when a trusted cookie was unavailable at callback time. Use credentials/cookies with browser requests; the device cookie is not a bearer-token replacement.

OAuth errors redirect to `/login?error=oauth_failed` or `/login?error=account_disabled`. Missing frontend configuration can result in a server error.

## Public authentication payloads

| Endpoint | JSON body | Result and endpoint-specific failures |
|---|---|---|
| `POST /auth/otp/check-trusted` | `pending`: required string, exactly 40 characters | `data.trusted`; if true, also `exchange_code`. Expired session: `410`; blocked account: `403` |
| `POST /auth/otp/verify` | `user_id`: existing user UUID; `pending`: 40-character string; `code`: six digits, preferably a string preserving leading zeros | `data.exchange_code`; `410` expired pending session, `404` no pending OTP, `422` invalid/expired OTP, `429` attempt budget exhausted, `403` blocked account |
| `POST /auth/otp/resend` | `user_id`: existing user UUID; `pending`: 40-character string | Success message with `data: null`; minimum 30 seconds between sends. Cooldown/attempt lockout: `429`; expired session: `410` |
| `POST /auth/exchange` | `code`: required string, exactly 40 characters | `data: {token, user}`; invalid/expired/consumed code: `401`; blocked account: `403` |

An OTP permits five failed guesses. Resending a still-valid code carries over its attempt count. These limits apply alongside HTTP throttles.

## Account and role rules

| Account | Current behavior |
|---|---|
| Verified `@student.laverdad.edu.ph` | New account defaults to approved `student` |
| Verified `@laverdad.edu.ph` | New account defaults to approved `instructor` |
| Existing pending institutional account | Auto-approved on Google sign-in; pre-registered role is preserved |
| Verified external Google account | New account defaults to pending `student`; administrator must review it |
| Pending account | May finish authentication and use shared protected endpoints; all role-group endpoints require approval |
| Deactivated, null, or unknown status | Login/session access denied; active middleware revokes existing tokens |

External login also depends on Google's OAuth audience configuration. Domain values are configurable in `config/institution.php`.

Tokens have an 8-hour absolute lifetime and a 15-minute API-request idle timeout. Polling counts as activity. `/logout` revokes the current token; it does not clear the trusted-device cookie.

Role access is not hierarchical: administrators do not automatically pass instructor or student route groups. A user assigned to head a program can pass the program-head middleware via `headedProgramIds()` while retaining their primary role. Controllers may impose further checks: audit logs explicitly require primary role `administrator` or `program_head` and therefore reject an instructor who only has the program-head override.
