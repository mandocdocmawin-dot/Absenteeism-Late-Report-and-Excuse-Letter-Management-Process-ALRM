# Source map and maintenance

[API documentation index](README.md)

| Contract | Source relative to backend |
|---|---|
| Registered API methods, paths, and groups | `routes/api.php` |
| Health path and JSON exception handling | `bootstrap/app.php` |
| Token idle timeout and named rate limits | `app/Providers/AppServiceProvider.php` |
| Absolute token expiry | `config/sanctum.php`, authentication controllers |
| Login, OTP, profile | `app/Http/Controllers/Auth/`, `app/Support/TrustedDeviceManager.php` |
| Approved-role and active-status gates | `app/Http/Middleware/RoleMiddleware.php`, `EnsureUserIsActive.php`, `app/Enums/UserStatus.php` |
| Pagination | `app/Support/BoundedCollection.php` |
| Student contracts and evidence | `app/Http/Controllers/Student/`, `app/Support/EvidenceImageProcessor.php` |
| Decisions and flag resolution | `app/Http/Controllers/Instructor/`, `app/Policies/ExcuseRequestPolicy.php`, `FollowupFlagPolicy.php` |
| Administration and exports | `app/Http/Controllers/Admin/`, `app/Http/Controllers/ProgramHead/` |
| Audit contracts | `app/Http/Controllers/AuditLogController.php`, `app/Http/Resources/AuditLogResource.php` |
| User response privacy | `app/Http/Resources/UserResource.php`, `app/Models/User.php` |
| Attendance formulas | `app/Models/AttendanceTracker.php`, `app/Models/ClassModel.php` |

Related guides: [Backend implementation guide](../../BACKEND.md) and [PHP and application security](../SECURITY-PHP.md). API and operational details are organized by topic in this directory.

When routes, validation, response resources, or policies change, update the relevant topic pages and endpoint inventory with them. Controllers not registered in `routes/api.php` are not public endpoints. Draft save/submit endpoints mentioned in TODO comments are not implemented routes. On a compatible configured PHP runtime, `php artisan route:list --path=api` can be used to compare the runtime route list with this inventory; it is not an integration test.
