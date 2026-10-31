# Frontend input normalization and validation

Scope: frontend only; backend is a read-only contract reference. Keep React text escaping, CSP, cookie authentication, uploads and backend error feedback intact.

1. Add tests for normalized Unicode text, control characters, invalid names/email, malformed selections, real calendar dates, numeric bounds, and invalid requests issuing no network calls.
2. Add small shared normalization/validation helpers. Normalize on submission, retain legitimate punctuation and multiline explanations, and return field errors. Do not use HTML stripping or alter authentication secrets.
3. Connect helpers to profile setup, admin account/program/class creation, student request creation/edits, OTP entry and report filters. Validate selected records against loaded options in each form.
4. Preserve existing 50-character text and 100-character explanation limits. Keep server-owned identity fields read-only. Supply the class year field already required by the backend.
5. Run focused tests, scoped lint, production build and a bounded full test run. Report existing failures separately. Do not stage, commit or edit backend files.
