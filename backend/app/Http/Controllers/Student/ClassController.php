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
            ->with('class.instructor', 'class.program')
            ->get();

        $data = $enrollments->map(function ($enrollment) {
            return [
                'enrollment_id' => $enrollment->id,
                'class_id'      => $enrollment->class_id,
                'subject_name'  => $enrollment->class->subject_name,
                'schedule'      => $enrollment->class->schedule,
                'instructor'    => $enrollment->class->instructor?->only(['id', 'name']),
                'program'       => $enrollment->class->program?->program_name,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => null,
            'data'    => $data,
        ]);
    }
}