<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Student\ClassController;
use App\Http\Controllers\Student\RequestController;
use App\Http\Controllers\Student\AttendanceController;
use App\Http\Controllers\Instructor\InstructorRequestController;
use App\Http\Controllers\Instructor\InstructorDashboardController;
use App\Http\Controllers\ProgramHead\ProgramHeadDashboardController;
use App\Http\Controllers\Admin\AdminDashboardController;
use App\Http\Controllers\Admin\UserApprovalController;
use App\Http\Controllers\Admin\ProgramController;
use App\Http\Controllers\Admin\ClassManagementController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Auth\OtpController;
use App\Http\Controllers\DbTestController;

/*
|--------------------------------------------------------------------------
| TEMPORARY — DB / Deploy sanity-check routes (Priority 6)
|--------------------------------------------------------------------------
| Not part of the real ALRM feature set. No auth required so they're easy
| to hit from a browser/Postman right after a deploy. Safe to delete this
| whole block (and DbTestController.php) once TiDB Cloud + Render are
| confirmed working end-to-end.
*/

Route::get('/health', [DbTestController::class, 'health']);
Route::get('/test/programs', [DbTestController::class, 'index']);
Route::post('/test/programs', [DbTestController::class, 'store']);
Route::patch('/test/programs/{program}', [DbTestController::class, 'update']);
Route::delete('/test/programs/{program}', [DbTestController::class, 'destroy']);

/*
|--------------------------------------------------------------------------
| Auth Routes (Google OAuth/SSO — README §9/§10, no email/password reg)
|--------------------------------------------------------------------------
*/

Route::prefix('auth')->group(function () {
    Route::get('/google/redirect', [AuthController::class, 'redirect']);
    Route::get('/google/callback', [AuthController::class, 'callback']);
    Route::post('/exchange', [AuthController::class, 'exchange']);
    Route::post('/otp/verify', [OtpController::class, 'verify'])
        ->middleware('throttle:10,1');
    Route::post('/otp/resend', [OtpController::class, 'resend'])
        ->middleware('throttle:10,1');
});

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    /*
    |----------------------------------------------------------------
    | Student Routes
    |----------------------------------------------------------------
    */
    Route::middleware('role:student')->group(function () {
        Route::get('/classes', [ClassController::class, 'index']);

        Route::post('/requests', [RequestController::class, 'store']);
        Route::get('/requests', [RequestController::class, 'index']);
        Route::get('/requests/{request}', [RequestController::class, 'show']);

        Route::get('/attendance/summary', [AttendanceController::class, 'summary']);
    });

    /*
    |----------------------------------------------------------------
    | Instructor Routes
    |----------------------------------------------------------------
    */
    Route::prefix('instructor')->middleware('role:instructor')->group(function () {
        Route::get('/requests', [InstructorRequestController::class, 'index']);
        Route::patch('/requests/{request}/decision', [InstructorRequestController::class, 'decide']);
        Route::get('/dashboard', [InstructorDashboardController::class, 'index']);
    });

    /*
    |----------------------------------------------------------------
    | Program Head Routes
    |----------------------------------------------------------------
    */
    Route::prefix('program-head')->middleware('role:program_head')->group(function () {
        Route::get('/dashboard', [ProgramHeadDashboardController::class, 'index']);
        Route::get('/students/flagged', [ProgramHeadDashboardController::class, 'flaggedStudents']);
        Route::get('/requests', [ProgramHeadDashboardController::class, 'requests']);
    });

    /*
    |----------------------------------------------------------------
    | Administrator Routes
    |----------------------------------------------------------------
    */
    Route::prefix('admin')->middleware('role:administrator')->group(function () {
        Route::get('/dashboard', [AdminDashboardController::class, 'index']);

        Route::get('/users', [UserApprovalController::class, 'index']);
        Route::patch('/users/{user}/role', [UserApprovalController::class, 'updateRole']);

        Route::apiResource('programs', ProgramController::class);
        Route::apiResource('classes', ClassManagementController::class);

        Route::get('/reports/export', [ReportController::class, 'export']);
        Route::get('/reports/preview', [ReportController::class, 'preview']);
    });
});
