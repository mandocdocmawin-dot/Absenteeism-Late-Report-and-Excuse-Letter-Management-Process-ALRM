<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Services\AcademicPeriod;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AttendanceController extends Controller
{
    public function summary(Request $request)
    {
        $period = AcademicPeriod::resolveFilters($request);
        $enrollments = Enrollment::where('student_id', Auth::id())
            ->whereHas('class', fn ($query) => $query->forAcademicPeriod($period))
            ->with(['class', 'attendanceTracker'])
            ->get();

        $data = $enrollments->map(function ($enrollment) {
            if ($enrollment->attendanceTracker) {
                $this->authorize('view', $enrollment->attendanceTracker);
            }

            return [
                'class_id'     => $enrollment->class_id,
                'subject_name' => $enrollment->class->subject_name,
                'tracker'      => $enrollment->attendanceTracker,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => null,
            'data'    => $data,
        ]);
    }
}
