<?php

namespace App\Policies;

use App\Models\AttendanceTracker;
use App\Models\User;

class AttendanceTrackerPolicy
{
    /**
     * Administrator: any tracker. Student: their own only.
     * Instructor: trackers for students in their class.
     * Program Head: trackers for students in the program they head.
     */
    public function view(User $user, AttendanceTracker $tracker): bool
    {
        if ($user->role === 'administrator') {
            return true;
        }

        $enrollment = $tracker->enrollment;

        if ($enrollment->student_id === $user->id) {
            return true;
        }

        if ($enrollment->class->instructor_id === $user->id) {
            return true;
        }

        return $enrollment->student->program?->program_head_id === $user->id;
    }
}