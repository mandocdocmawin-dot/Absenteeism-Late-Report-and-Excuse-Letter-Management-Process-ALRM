<?php

use App\Http\Controllers\Admin\AdminDashboardController;
use App\Http\Controllers\Admin\ClassManagementController;
use App\Http\Controllers\Admin\CurriculumController;
use App\Http\Controllers\Admin\ProgramController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\TeachingAssignmentController;
use App\Http\Controllers\Admin\UserApprovalController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\OtpController;
use App\Http\Controllers\Auth\ProfileController;
use App\Http\Controllers\Instructor\FollowupController as InstructorFollowupController;
use App\Http\Controllers\Instructor\InstructorDashboardController;
use App\Http\Controllers\Instructor\InstructorRequestController;
use App\Http\Controllers\Instructor\InstructorRequestExportController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProgramHead\FollowupFlagController;
use App\Http\Controllers\ProgramHead\ProgramHeadDashboardController;
use App\Http\Controllers\ProgramHead\ProgramHeadReportController;
use App\Http\Controllers\Student\AttendanceController;
use App\Http\Controllers\Student\ClassController;
use App\Http\Controllers\Student\EvidenceController;
use App\Http\Controllers\Student\FollowUpController;
use App\Http\Controllers\Student\RequestController;
use App\Http\Controllers\Student\StudentDashboardController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Auth Routes (Google OAuth/SSO no email/password reg)
|--------------------------------------------------------------------------
*/

Route::prefix('auth')->middleware('throttle:login')->group(function () {
    Route::get('/google/redirect', [AuthController::class, 'redirect']);
    Route::get('/google/callback', [AuthController::class, 'callback']);
    Route::post('/exchange', [AuthController::class, 'exchange']);
    Route::post('/otp/check-trusted', [AuthController::class, 'checkTrusted'])
        ->middleware('throttle:otp');
    Route::post('/otp/verify', [OtpController::class, 'verify'])
        ->middleware('throttle:otp');
    Route::post('/otp/resend', [OtpController::class, 'resend'])
        ->middleware('throttle:otp');
});

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::patch('/me/notification-preferences', [ProfileController::class, 'updateNotificationPreferences']);
    Route::get('/complete-profile/programs', [ProfileController::class, 'programs']);
    Route::post('/complete-profile', [ProfileController::class, 'completeProfile']);

    /*
    |----------------------------------------------------------------
    | Notifications
    |----------------------------------------------------------------
    */
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/preview', [NotificationController::class, 'preview']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);   // dapat nasa unahan
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markAsRead']);

    /*
    |----------------------------------------------------------------
    | Request attachment
    |----------------------------------------------------------------
    */
    Route::get('/requests/{request}/evidence', [RequestController::class, 'evidence']);

    /*
    |----------------------------------------------------------------
    | Student Routes
    |----------------------------------------------------------------
    */
    Route::middleware('role:student')->group(function () {
        Route::get('/dashboard', [StudentDashboardController::class, 'index']);

        Route::get('/classes', [ClassController::class, 'index']);

        Route::post('/requests/evidence', [EvidenceController::class, 'store'])
            ->middleware('throttle:20,1');

        Route::post('/requests', [RequestController::class, 'store'])->middleware('throttle:submissions');
        Route::get('/requests', [RequestController::class, 'index']);
        Route::get('/requests/{request}', [RequestController::class, 'show']);
        Route::patch('/requests/{request}', [RequestController::class, 'update']);
        Route::delete('/requests/{request}', [RequestController::class, 'destroy']);
        Route::post('/requests/{request}/follow-up', [FollowUpController::class, 'store'])
            ->middleware('throttle:5,1');

        Route::get('/attendance/summary', [AttendanceController::class, 'summary']);
    });

    /*
    |----------------------------------------------------------------
    | Instructor Routes
    |----------------------------------------------------------------
    */
    Route::prefix('instructor')->middleware('role:instructor')->group(function () {
        Route::get('/requests/export', [InstructorRequestExportController::class, 'export'])->middleware('throttle:exports');
        Route::get('/requests', [InstructorRequestController::class, 'index']);
        Route::patch('/requests/{request}/decision', [InstructorRequestController::class, 'decide']);
        Route::get('/dashboard', [InstructorDashboardController::class, 'index']);

        // Follow-ups galing sa students
        Route::get('/followups', [InstructorFollowupController::class, 'index']);
        Route::patch('/followups/{followupFlag}/resolve', [InstructorFollowupController::class, 'resolve']);
    });

    /*
    |----------------------------------------------------------------
    | Program Head Routes
    |----------------------------------------------------------------
    */
    Route::prefix('program-head')->middleware('role:program_head')->group(function () {
        Route::get('/reports/export', [ProgramHeadReportController::class, 'export'])->middleware('throttle:exports');
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
        Route::get('/dashboard', [ProgramHeadDashboardController::class, 'index']);
        Route::get('/students', [ProgramHeadDashboardController::class, 'students']);
        Route::get('/instructors', [ProgramHeadDashboardController::class, 'instructors']);
        Route::get('/students/flagged', [ProgramHeadDashboardController::class, 'flaggedStudents']);
        Route::patch('/followup-flags/{followupFlag}/resolve', [FollowupFlagController::class, 'resolve']);
        Route::get('/requests', [ProgramHeadDashboardController::class, 'requests']);
    });

    /*
    |----------------------------------------------------------------
    | Administrator Routes
    |----------------------------------------------------------------
    */
    Route::prefix('admin')->middleware('role:administrator')->group(function () {
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
        Route::get('/dashboard', [AdminDashboardController::class, 'index']);
        Route::apiResource('users', UserApprovalController::class)->only(['index', 'store', 'destroy']);
        Route::patch('/users/{user}/role', [UserApprovalController::class, 'updateRole']);
        Route::patch('/users/{user}/status', [UserApprovalController::class, 'updateStatus']);

        Route::apiResource('programs', ProgramController::class);
        Route::apiResource('classes', ClassManagementController::class);
        Route::get('/classes/{class}/assignments', [TeachingAssignmentController::class, 'history']);
        Route::post('/classes/{class}/assignment', [TeachingAssignmentController::class, 'change']);
        Route::get('/classes/{class}/pending-requests', [TeachingAssignmentController::class, 'pendingRequests']);
        Route::apiResource('curricula', CurriculumController::class)->only(['index', 'store', 'show']);

        Route::get('/reports/export', [ReportController::class, 'export'])->middleware('throttle:exports');
        Route::get('/reports/preview', [ReportController::class, 'preview']);
    });
});
