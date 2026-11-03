# Mail delivery and operations

[API documentation index](README.md)

`MailDeliveryService` handles delivery for `InstructorExcuseRequestMail`, `StudentRequestUpdatedMail`, and `InstructorFollowUpMail`. All three are queued with up to three attempts. Their existing Blade templates remain unchanged. The existing queue worker must be running; deployment configuration already includes it in `docker/supervisord.conf`.

The service skips inactive accounts and blank email addresses. Instructor new-request and follow-up mail share the same case-insensitive allowlist check. An instructor test recipient redirects allowed instructor mail; a student test recipient redirects student update mail. Test redirects do not change in-app recipients. `MAIL_TEST_RECIPIENT` is a fallback for request/alert emails only, handled by the delivery services rather than `Mail::alwaysTo`. OTP emails always reach the account logging in, even if test-recipient settings are configured.

For program head warning, critical, and IR testing only, set `MAIL_PROGRAM_HEAD_TEST_RECIPIENT=marwin.mandocdoc@student.laverdad.edu.ph` in the deployment environment. This overrides the generic fallback for these alerts. One email per warning/critical/IR stage is queued to that address even when several heads share the program; their individual in-app alerts stay on their actual accounts. Clear this setting to restore actual-head email recipients (also clear `MAIL_TEST_RECIPIENT` if no fallback redirect is wanted). Redeploy/restart the application and queue workers after changing the environment.

In-app notifications are stored within the business transaction. Mail dispatch is deferred with `afterCommit()`, so rolled-back requests do not leave alerts or email jobs. The request observer runs during the transaction so it can reliably check the original pending status when a decision is saved. Only transitions from pending to approved, noted, or invalid queue a student decision email; cancellation does not.

New submissions create one instructor in-app alert; decisions retain the existing student in-app alert from the decision controller; follow-ups create one instructor in-app alert alongside their existing cooldown-protected follow-up record. Email allowlists do not suppress these in-app alerts. Student follow-up emails now use the same `/instructor/class-requests` link as instructor submission emails.

The notifications API, unread count, mark-read actions, and student dashboard only use `channel = in_app`. Historical `channel = email` rows remain in the database but do not appear in personal notification feeds and cannot be marked read through the in-app endpoints. Queuing an email no longer creates a misleading "sent" notification row; queue and failed-job records are used for delivery troubleshooting. A queued job is not proof of successful delivery.

Program head threshold alerts retain their dedicated `AttendanceThresholdNotifier`, which handles stage deduplication and uses the same queued, after-commit approach for its email. Request mail recipient rules do not change program head routing.

Request email buttons use `FRONTEND_URL_PROD` so instructor review links and student dashboard links open the deployed system even when `FRONTEND_URL` points to a local development server. Follow-up links are resolved again during delivery to replace localhost links stored in older queued emails. Messages already delivered retain their original links.

Tests use isolated databases and fake or array mail transports. `RequestMailDeliveryTest` covers request submission, repeated decisions, follow-up cooldown, redirects and allowlists, cancellation and inactive recipients, transaction rollback/commit, and separation of historical email records from in-app feeds.
