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
            ->with(['enrollments.student', 'enrollments.attendanceTracker'])
            ->get();

        $flaggedStudents = $classes->flatMap(function ($class) {
            return $class->enrollments->filter(function ($enrollment) {
                return $enrollment->attendanceTracker
                    && in_array($enrollment->attendanceTracker->status, ['warning', 'IR'], true);
            })->map(function ($enrollment) use ($class) {
                return [
                    'student'  => $enrollment->student->only(['id', 'name']),
                    'class'    => $class->subject_name,
                    'status'   => $enrollment->attendanceTracker->status,
                    'absences' => $enrollment->attendanceTracker->converted_absences,
                ];
            });
        })->values();

        $pendingRequests = ExcuseRequest::whereHas('enrollment.class', function ($q) {
            $q->where('instructor_id', Auth::id());
        })->where('status', 'pending')
          ->with('enrollment.student', 'enrollment.class')
          ->latest()
          ->get();

        $data = [
            'total_classes'     => $classes->count(),
            'total_students'    => $classes->sum(fn ($c) => $c->enrollments->count()),
            'pending_requests'  => $pendingRequests,
            'flagged_students'  => $flaggedStudents,
        ];

        return response()->json([
            'success' => true,
            'message' => null,
            'data'    => $data,
        ]);
    }
}