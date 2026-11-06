<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Http\Resources\StudentDashboardResource;
use App\Models\AttendanceTracker;
use App\Models\Enrollment;
use App\Models\ExcuseRequest;
use App\Models\User;
use App\Models\UserNotification;
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

        $enrollments = Enrollment::where('student_id', $student->id)
            ->whereHas('class', fn ($query) => $query->forAcademicPeriod())
            ->with(['class', 'attendanceTracker'])
            ->get();

        /** @var Collection<int, AttendanceTracker> $trackers */
        $trackers = $enrollments->pluck('attendanceTracker')->filter();
        foreach ($enrollments as $enrollment) {
            $enrollment->attendanceTracker?->setRelation('enrollment', $enrollment);
        }

        $ownRequests = fn () => ExcuseRequest::query()
            ->whereHas('enrollment', fn ($q) => $q->where('student_id', $student->id))
            ->whereHas('enrollment.class', fn ($query) => $query->forAcademicPeriod());

        $pendingRequests = $ownRequests()->where('status', 'pending')->count();

        $excusedAbsences = $ownRequests()
            ->where('type', 'absence')
            ->whereIn('status', ['approved', 'noted'])
            ->count();

        $totalHours = (float) $enrollments->sum(fn ($enrollment) => $enrollment->class->totalSemesterHours());
        $weeklyHours = (float) $enrollments->sum(fn ($enrollment) => $enrollment->class->weekly_hours);
        $usedHours = round($trackers->sum(fn (AttendanceTracker $tracker) => $tracker->unitsUsed()), 2);
        $exactLimit = $totalHours * config('alrm.absence_limit_rate');
        $limit = round($exactLimit, 2);
        $absencePercentage = $totalHours > 0 ? $usedHours / $totalHours * 100 : 0;
        $thresholdStatus = match (true) {
            $totalHours <= 0 => 'safe',
            $usedHours >= $exactLimit => 'IR',
            $usedHours >= $weeklyHours * config('alrm.critical_absence_weeks') => 'critical',
            $usedHours >= $weeklyHours * config('alrm.preventive_absence_weeks') => 'warning',
            default => 'safe',
        };

        $subjectThresholds = $enrollments->map(function ($enrollment) {
            $tracker = $enrollment->attendanceTracker;

            return [
                'class_id' => $enrollment->class_id,
                'subject_name' => $enrollment->class->subject_name,
                'absences' => $tracker?->total_absences ?? 0,
                'used_hours' => $tracker?->unitsUsed() ?? 0,
                'total_semester_hours' => $enrollment->class->totalSemesterHours(),
                'absence_percentage' => $tracker?->absencePercentage() ?? 0,
                'ir_absence_limit' => config('alrm.subject_ir_absences'),
                'status' => $tracker?->subjectStatus() ?? 'safe',
            ];
        })->values();

        $notifications = UserNotification::inApp()
            ->where('user_id', $student->id);

        return response()->json([
            'success' => true,
            'message' => null,
            'data' => new StudentDashboardResource([
                'total_classes' => $enrollments->count(),
                'unexcused_absences' => $ownRequests()->where('type', 'absence')->where('status', 'invalid')->count(),
                'excused_absences' => $excusedAbsences,
                'lates_recorded' => (int) $trackers->sum('total_lates'),
                'pending_requests' => $pendingRequests,
                'threshold' => [
                    'used' => $usedHours,
                    'limit' => $limit,
                    'total_semester_hours' => $totalHours,
                    'absence_percentage' => round($absencePercentage, 2),
                    'remaining_hours' => round(max(0, $exactLimit - $usedHours), 2),
                    'status' => $thresholdStatus,
                    'remaining_semester_percentage' => $totalHours > 0
                        ? round(max(0, config('alrm.absence_limit_rate') * 100 - $absencePercentage), 2)
                        : 0,
                ],
                'subject_thresholds' => $subjectThresholds,
                'unread_notifications' => (clone $notifications)->where('is_read', false)->count(),
                'recent_notifications' => (clone $notifications)->latest('date_sent')->limit(5)->get(),
            ]),
        ]);
    }
}
