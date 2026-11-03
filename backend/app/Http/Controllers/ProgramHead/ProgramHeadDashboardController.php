<?php

namespace App\Http\Controllers\ProgramHead;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProgramHeadFlagResource;
use App\Http\Resources\UserResource;
use App\Models\AttendanceTracker;
use App\Models\ExcuseRequest;
use App\Models\FollowupFlag;
use App\Models\Program;
use App\Models\User;
use App\Support\BoundedCollection;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class ProgramHeadDashboardController extends Controller
{
    /**
     * Dashboard summary for the Program Head's own program.
     * Per interview: aggregated version of the Instructor dashboard —
     * absent students, warning/IR counts, and recently flagged cases.
     */
    public function index()
    {
        /** @var User $user */
        $user = Auth::user();
        $programIds = $user->headedProgramIds();

        if (! $programIds) {
            return response()->json([
                'success' => false,
                'message' => 'No program is assigned to this account.',
                'data' => null,
            ], 403);
        }

        $trackerQuery = AttendanceTracker::whereHas('enrollment.class', function ($q) use ($programIds) {
            $q->whereIn('program_id', $programIds);
        });

        $data = [
            'program_name' => Program::whereIn('id', $programIds)->pluck('program_name')->implode(', '),
            'total_students' => User::where('role', 'student')->whereIn('program_id', $programIds)->count(),
            'total_instructors' => $this->instructorQuery($programIds)->count(),
            'total_classes' => Program::whereIn('id', $programIds)->withCount('classes')->get()->sum('classes_count'),
            'pending_requests' => ExcuseRequest::whereHas('enrollment.class', function ($q) use ($programIds) {
                $q->whereIn('program_id', $programIds);
            })->where('status', 'pending')->count(),
            'warning_count' => (clone $trackerQuery)->where('status', 'warning')->count(),
            'ir_count' => (clone $trackerQuery)->where('status', 'IR')->count(),
            'critical_count' => (clone $trackerQuery)->where('status', 'critical')->count(),
            'recent_flags' => $this->flagQuery()
                ->with('request.enrollment.student', 'request.enrollment.class')
                ->latest('flagged_date')
                ->take(5)
                ->get(),
        ];

        return response()->json([
            'success' => true,
            'message' => null,
            'data' => $data,
        ]);
    }

    /**
     * Students escalated to this Program Head via FollowupFlag.
     * Supports ?status=open|resolved filter; defaults to all.
     */
    public function flaggedStudents(Request $request)
    {
        $query = $this->flagQuery()
            ->with([
                'request.enrollment.student',
                'request.enrollment.class',
                'request.enrollment.attendanceTracker',
                'request.reviewer',
            ]);

        if ($request->filled('status')) {
            $request->validate([
                'status' => ['string', Rule::in(['open', 'resolved'])],
            ]);
            $query->where('status', $request->query('status'));
        }

        $flags = $query->latest('flagged_date');

        return BoundedCollection::respond($flags, ProgramHeadFlagResource::class);
    }

    /**
     * All excuse/late requests within the Program Head's program, for
     * monitoring — includes the instructor's decision and remarks.
     */
    public function requests(Request $request)
    {
        /** @var User $user */
        $user = Auth::user();
        $programIds = $user->headedProgramIds();

        if (! $programIds) {
            return response()->json([
                'success' => false,
                'message' => 'No program is assigned to this account.',
                'data' => null,
            ], 403);
        }

        $query = ExcuseRequest::whereHas('enrollment.class', function ($q) use ($programIds) {
            $q->whereIn('program_id', $programIds);
        })->with(['enrollment.student', 'enrollment.class.instructor', 'reviewer', 'followupFlag']);

        if ($request->filled('status')) {
            $request->validate([
                'status' => ['string', Rule::in(['pending', 'approved', 'noted', 'invalid'])],
            ]);
            $query->where('status', $request->query('status'));
        }

        $requests = $query->latest();

        return BoundedCollection::respond($requests);
    }

    public function students()
    {
        /** @var User $user */
        $user = Auth::user();
        $programIds = $user->headedProgramIds();
        abort_unless($programIds !== [], 403, 'No program is assigned to this account.');

        /** @var Builder<User> $students */
        $students = User::query();
        $students->where('role', 'student')->whereIn('program_id', $programIds)->with('program')->orderBy('name');

        return BoundedCollection::respond($students, UserResource::class);
    }

    public function instructors()
    {
        /** @var User $user */
        $user = Auth::user();
        $programIds = $user->headedProgramIds();
        abort_unless($programIds !== [], 403, 'No program is assigned to this account.');

        return BoundedCollection::respond($this->instructorQuery($programIds)->with('programs')->orderBy('name'), UserResource::class);
    }

    /** @return Builder<User> */
    private function instructorQuery(array $programIds): Builder
    {
        /** @var Builder<User> $instructors */
        $instructors = User::query();
        $instructors->where('role', 'instructor')->where(function ($query) use ($programIds) {
            $query->whereHas('programs', fn ($query) => $query->whereIn('programs.id', $programIds))
                ->orWhereHas('classesTaught', fn ($query) => $query->whereIn('program_id', $programIds));
        });

        return $instructors;
    }

    private function flagQuery()
    {
        /** @var User $user */
        $user = Auth::user();
        $programIds = $user->headedProgramIds();

        return FollowupFlag::where(function ($query) use ($programIds) {
            $query->where('escalated_to', Auth::id())
                ->orWhereHas('request.enrollment.class', fn ($query) => $query->whereIn('program_id', $programIds));
        });
    }
}
