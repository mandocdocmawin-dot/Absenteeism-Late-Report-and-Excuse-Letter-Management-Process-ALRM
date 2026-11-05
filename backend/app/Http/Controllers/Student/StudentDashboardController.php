<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Http\Resources\StudentDashboardResource;
use App\Models\AttendanceTracker;
use App\Models\ExcuseRequest;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\AcademicPeriod;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentDashboardController extends Controller
{
    /**
     * GET /api/dashboard
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $student */
        $student = $request->user();

        /** @var Collection<int, AttendanceTracker> $trackers */
        $trackers = AttendanceTracker::query()
            ->whereHas('enrollment', fn ($q) => $q->where('student_id', $student->id))
            ->with('enrollment.class')
            ->get();

        $ownRequests = fn () => ExcuseRequest::query()
            ->whereHas('enrollment', fn ($q) => $q->where('student_id', $student->id));

        $pendingRequests = $ownRequests()->where('status', 'pending')->count();

        $excusedAbsences = $ownRequests()
            ->where('type', 'absence')
            ->whereIn('status', ['approved', 'noted'])
            ->count();

        $thresholdStatus = match (true) {
            $trackers->contains('status', 'IR') => 'IR',
            $trackers->contains('status', 'critical') => 'critical',
            $trackers->contains('status', 'warning') => 'warning',
            default => 'safe',
        };

        /** @var AttendanceTracker|null $closest */
        $closest = $trackers->sortByDesc(fn (AttendanceTracker $tracker): float => $tracker->usageRatio())->first();

        $notifications = UserNotification::inApp()
            ->where('user_id', $student->id);

        return response()->json([
            'success' => true,
            'message' => null,
            'data' => new StudentDashboardResource([
                'total_classes' => $student->enrollments()
                    ->whereHas('class', fn ($q) => $q
                        ->where('semester', AcademicPeriod::semester())
                        ->where('school_year', AcademicPeriod::schoolYear()))
                    ->count(),
                'unexcused_absences' => (int) $trackers->sum('total_absences'),
                'excused_absences' => $excusedAbsences,
                'lates_recorded' => (int) $trackers->sum('total_lates'),
                'pending_requests' => $pendingRequests,
                'threshold' => [
                    'used' => $closest?->unitsUsed() ?? 0,
                    'limit' => $closest?->allowedUnits() ?? 0,
                    'status' => $thresholdStatus,
                    'remaining_semester_percentage' => $closest?->remainingSemesterPercentage() ?? 0,
                ],
                'unread_notifications' => (clone $notifications)->where('is_read', false)->count(),
                'recent_notifications' => (clone $notifications)->latest('date_sent')->limit(5)->get(),
            ]),
        ]);
    }
}
