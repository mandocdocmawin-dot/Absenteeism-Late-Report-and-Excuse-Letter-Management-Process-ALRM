<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AttendanceTracker;
use App\Models\ClassModel;
use App\Models\ExcuseRequest;
use App\Models\FollowupFlag;
use App\Models\Program;
use App\Models\User;

class AdminDashboardController extends Controller
{
    /**
     * College-wide dashboard snapshot for the Administrator — the
     * aggregated-across-every-program version of what
     * ProgramHeadDashboardController::index() shows for a single program.
     *
     * Role gate only (route group is role:administrator in api.php) —
     * no Policy needed here, same reasoning as Program/ClassModel CRUD in
     * BACKEND.md §2.1: admin is a single trusted role for now. If ALRM ever
     * moves to multiple admins scoped to specific programs, this — and the
     * Program/ClassModel controllers — would need a Policy instead.
     *
     * GET /api/admin/dashboard
     */
    public function index()
    {
        $data = [
            'total_programs'          => Program::count(),
            'total_classes'           => ClassModel::count(),
            'total_students'          => User::where('role', 'student')->count(),
            'total_instructors'       => User::where('role', 'instructor')->count(),
            'total_program_heads'     => User::where('role', 'program_head')->count(),
            'pending_staff_approvals' => User::where('status', 'pending')->whereNull('role')->count(),
            'pending_requests'        => ExcuseRequest::where('status', 'pending')->count(),
            'warning_count'           => AttendanceTracker::where('status', 'warning')->count(),
            'ir_count'                => AttendanceTracker::where('status', 'IR')->count(),
            'open_followup_flags'     => FollowupFlag::where('status', 'open')->count(),
            'programs_summary' => Program::withCount([
                    'classes',
                    'users as student_count' => fn ($q) => $q->where('role', 'student'),
                ])
                ->get(['id', 'program_name', 'program_head_id']),

            'recent_flags' => FollowupFlag::with([
                    'request.enrollment.student',
                    'request.enrollment.class.program',
                    'escalatedTo',
                ])
                ->latest('flagged_date')
                ->take(10)
                ->get(),
        ];

        return response()->json([
            'success' => true,
            'message' => null,
            'data'    => $data,
        ]);
    }
}