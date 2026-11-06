<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\ClassModel;
use App\Models\ExcuseRequest;
use Illuminate\Support\Facades\Auth;

class InstructorDashboardController extends Controller
{
    /**
     * Instructor dashboard snapshot, per interview:
     * pending requests, students at warning/IR, per-class attendance status.
     */
    public function index()
    {
        $classes = ClassModel::where('instructor_id', Auth::id())
            ->forAcademicPeriod()
            ->with(['enrollments.student', 'enrollments.attendanceTracker'])
            ->get();

        $flaggedStudents = $classes->flatMap(function ($class) {
            return $class->enrollments->filter(function ($enrollment) use ($class) {
                $enrollment->setRelation('class', $class);
                $enrollment->attendanceTracker?->setRelation('enrollment', $enrollment);

                return $enrollment->attendanceTracker
                    && in_array($enrollment->attendanceTracker->subjectStatus(), ['warning', 'critical', 'IR'], true);
            })->map(function ($enrollment) use ($class) {
                return [
                    'student' => $enrollment->student->only(['id', 'name']),
                    'class' => $class->subject_name,
                    'class_id' => $class->id,
                    'status' => $enrollment->attendanceTracker->subjectStatus(),
                    'absences' => $enrollment->attendanceTracker->total_absences,
                    'converted_absences' => $enrollment->attendanceTracker->converted_absences,
                    'used_hours' => $enrollment->attendanceTracker->unitsUsed(),
                    'absence_percentage' => $enrollment->attendanceTracker->absencePercentage(),
                    'ir_absence_limit' => config('alrm.subject_ir_absences'),
                ];
            });
        })->values();

        $pendingRequests = ExcuseRequest::forInstructor(Auth::id(), true)->where('status', 'pending')
            ->whereHas('enrollment.class', fn ($query) => $query->forAcademicPeriod())
            ->with('enrollment.student', 'enrollment.class')
            ->latest()
            ->get();

        $data = [
            'total_classes' => $classes->count(),
            'total_students' => $classes->sum(fn ($c) => $c->enrollments->count()),
            'pending_requests' => $pendingRequests,
            'flagged_students' => $flaggedStudents,
        ];

        return response()->json([
            'success' => true,
            'message' => null,
            'data' => $data,
        ]);
    }
}
