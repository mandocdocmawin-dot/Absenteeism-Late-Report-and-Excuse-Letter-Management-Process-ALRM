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

/*
|--------------------------------------------------------------------------
| Auth Routes (Google OAuth/SSO — README §9/§10, no email/password reg)
|--------------------------------------------------------------------------
*/

Route::prefix('auth')->group(function () {
    Route::get('/google/redirect', [AuthController::class, 'redirect']);
    Route::get('/google/callback', [AuthController::class, 'callback']);
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
        Route::patch('/users/{user}/approve', [UserApprovalController::class, 'approve']);

        Route::apiResource('programs', ProgramController::class);
        Route::apiResource('classes', ClassManagementController::class);

        Route::get('/reports/export', [ReportController::class, 'export']);
    });
});
