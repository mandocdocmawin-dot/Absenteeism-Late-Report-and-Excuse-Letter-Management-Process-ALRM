<?php

namespace App\Http\Controllers\ProgramHead;

use App\Http\Controllers\Controller;
use App\Models\AttendanceTracker;
use App\Models\ExcuseRequest;
use App\Models\FollowupFlag;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ProgramHeadDashboardController extends Controller
{
    /**
     * Dashboard summary for the Program Head's own program.
     * Per interview: aggregated version of the Instructor dashboard —
     * absent students, warning/IR counts, and recently flagged cases.
     */
    public function index()
    {
        $program = Auth::user()->headedProgram;

        if (! $program) {
            return response()->json([
                'success' => false,
                'message' => 'No program is assigned to this account.',
                'data'    => null,
            ], 403);
        }

        $trackerQuery = AttendanceTracker::whereHas('enrollment.class', function ($q) use ($program) {
            $q->where('program_id', $program->id);
        });

        $data = [
            'program_name'     => $program->program_name,
            'total_students'   => $program->users()->where('role', 'student')->count(),
            'total_classes'    => $program->classes()->count(),
            'pending_requests' => ExcuseRequest::whereHas('enrollment.class', function ($q) use ($program) {
                $q->where('program_id', $program->id);
            })->where('status', 'pending')->count(),
            'warning_count'    => (clone $trackerQuery)->where('status', 'warning')->count(),
            'ir_count'         => (clone $trackerQuery)->where('status', 'IR')->count(),
            'recent_flags'     => FollowupFlag::where('escalated_to', Auth::id())
                ->with('request.enrollment.student', 'request.enrollment.class')
                ->latest('flagged_date')
                ->take(5)
                ->get(),
        ];

        return response()->json([
            'success' => true,
            'message' => null,
            'data'    => $data,
        ]);
    }

    /**
     * Students escalated to this Program Head via FollowupFlag (IR crossings).
     * Supports ?status=pending|resolved filter; defaults to all.
     */
    public function flaggedStudents(Request $request)
    {
        $query = FollowupFlag::where('escalated_to', Auth::id())
            ->with([
                'request.enrollment.student',
                'request.enrollment.class',
                'request.reviewer',
            ]);

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $flags = $query->latest('flagged_date')->get();

        return response()->json([
            'success' => true,
            'message' => null,
            'data'    => $flags,
        ]);
    }

    /**
     * All excuse/late requests within the Program Head's program, for
     * monitoring — includes the instructor's decision and remarks.
     */
    public function requests(Request $request)
    {
        $program = Auth::user()->headedProgram;

        if (! $program) {
            return response()->json([
                'success' => false,
                'message' => 'No program is assigned to this account.',
                'data'    => null,
            ], 403);
        }

        $query = ExcuseRequest::whereHas('enrollment.class', function ($q) use ($program) {
            $q->where('program_id', $program->id);
        })->with(['enrollment.student', 'enrollment.class.instructor', 'reviewer', 'followupFlag']);

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $requests = $query->latest()->get();

        return response()->json([
            'success' => true,
            'message' => null,
            'data'    => $requests,
        ]);
    }
}