<?php

/**
 * Institutional Google Workspace email domains, mapped to the role a
 * user resolves to on first Google login. Single source of truth for
 * this mapping — AuthController::callback() (login/role resolution)
 * and UserApprovalController::store() (pre-registration validation)
 * both read from here, instead of each keeping their own copy.
 *
 * Verified Google identities in these exact domains are auto-approved.
 * Other domains start pending administrator review. Google OAuth must
 * allow external users in its audience settings for them to reach the
 * callback; an Internal-only Google app blocks them before ALRM.
 */

return [
    'student_domain' => env('STUDENT_EMAIL_DOMAIN', 'student.laverdad.edu.ph'),
    'staff_domain' => env('STAFF_EMAIL_DOMAIN', 'laverdad.edu.ph'),

    /**
     * Dev accounts: instructors on a student-domain email, used to see
     * the instructor dashboard. Comma-separated in
     * SEED_DEV_INSTRUCTOR_EMAILS; empty by default.
     */
    'dev_instructor_emails' => array_values(array_filter(array_map(
        fn (string $email) => strtolower(trim($email)),
        explode(',', (string) env('SEED_DEV_INSTRUCTOR_EMAILS', '')),
    ))),
];
