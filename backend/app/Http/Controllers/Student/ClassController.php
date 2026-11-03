<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use Illuminate\Support\Facades\Auth;

class ClassController extends Controller
{
    /**
     * List classes the authenticated student is enrolled in.
     *
     * GET /api/classes
     */
    public function index()
    {
        $enrollments = Enrollment::where('student_id', Auth::id())
            ->whereHas('class.instructor')
            ->whereHas('class.activeTeachingAssignment')
            ->with('class.instructor', 'class.program', 'class.activeTeachingAssignment')
            ->get();

        $data = $enrollments->map(function ($enrollment) {
            return [
                'enrollment_id' => $enrollment->id,
                'class_id' => $enrollment->class_id,
                'teaching_assignment_id' => $enrollment->class->activeTeachingAssignment?->id,
                'subject_name' => $enrollment->class->subject_name,
                'section' => $enrollment->class->section,
                'schedule' => $enrollment->class->schedule,
                'semester' => $enrollment->class->semester,
                'school_year' => $enrollment->class->school_year,
                'year_level' => $enrollment->year_level,
                'instructor' => $enrollment->class->instructor?->only(['id', 'name']),
                'program' => $enrollment->class->program?->program_name,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => null,
            'data' => $data,
        ]);
    }
}
