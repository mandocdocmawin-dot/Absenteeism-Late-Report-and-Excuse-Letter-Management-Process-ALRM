# Evidence upload security

Every new late/absence submission requires an existing, unused attachment owned
by the signed-in student. An omitted/null/foreign/used attachment returns 422;
no request or guardian/contact change is committed. Existing historical requests
without evidence remain readable and their existing edit rules are unchanged.

PDF uploads require qpdf 11+ (JSON v2). The Docker image installs qpdf. For local
development install qpdf and set `QPDF_BINARY` to its executable path if it is not
on PATH. Images continue through GD decoding/re-encoding.

PDF validation inspects parsed object names, including escaped names, indirect
objects and compressed object streams. Actions, forms, embedded files,
interactive media, encryption, empty documents, parser warnings and malformed
files are rejected. A missing parser fails closed; it never falls back to a
header-only check. Parsing has a five-second timeout and an 8 MiB combined
stdout/stderr limit. Links implemented with PDF actions and interactive forms
must be flattened by the uploader; ordinary passive PDFs remain supported.

This is a restrictive document policy, not malware scanning or a general PDF
sanitizer. Keep qpdf/PHP patched and retain infrastructure resource limits.
Older attachments are not retroactively scanned by this change.

Run the regression suite from `backend/` with qpdf available:

```powershell
$env:QPDF_BINARY = 'C:/path/to/qpdf.exe'
$env:APP_ENV = 'testing'
$env:DB_CONNECTION = 'sqlite'
$env:DB_DATABASE = ':memory:'
$env:DB_URL = ''
$env:CACHE_STORE = 'array'
$env:SESSION_DRIVER = 'array'
$env:QUEUE_CONNECTION = 'sync'
$env:MAIL_MAILER = 'array'
$env:BCRYPT_ROUNDS = '4'
php -d memory_limit=768M vendor/bin/phpunit --no-configuration --bootstrap vendor/autoload.php --do-not-cache-result tests
composer audit --locked
```

`EvidenceUploadSecurityTest` verifies passive PDF acceptance; rejection of plain,
escaped and compressed JavaScript actions, embedded files, forms, encryption and
malformed files; parser failure; and required/owned/single-use attachments for
both request types. Fixtures contain inert comments, not executable payloads.
The command selects in-memory SQLite and array transports; SecurityTestCase also
fakes mail/notifications. Do not run against cached production configuration.

Deploy the updated Docker image before live testing: pushing `backend` alone does
not prove that Render has deployed that commit. Live cross-account and stored-XSS
tests require two controlled accounts and disposable records. The parser policy
and API behavior should be verified in that environment before real users rely
on the fix.
