<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Follow-up response window
    |--------------------------------------------------------------------------
    |
    | Hours a pending excuse/late request may sit unanswered before
    | RunAttendanceAutomation::flagOverdueRequests() escalates it to the
    | student's Program Head via a FollowupFlag.
    |
    | IMPORTANT: env() must only be called from within config/*.php files.
    | Calling it directly inside a Command/Controller breaks once
    | `php artisan config:cache` runs in production — the .env file is no
    | longer read at runtime past that point, only this cached config array.
    |
    */

    'followup_response_window_hours' => (int) env('FOLLOWUP_RESPONSE_WINDOW_HOURS', 48),

];