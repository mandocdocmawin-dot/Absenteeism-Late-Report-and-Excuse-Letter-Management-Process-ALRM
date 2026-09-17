<?php

namespace App\Policies;

use App\Models\ClassModel;
use App\Models\User;

class ClassModelPolicy
{
    /**
     * Administrator: any class. Instructor: their own class.
     * Program Head: classes under the program they head.
     * Student: classes they're enrolled in (assumes ClassModel::enrollments()
     * hasMany Enrollment — adjust relation name if yours differs).
     */
    public function view(User $user, ClassModel $class): bool
    {
        if ($user->role === 'administrator' || $class->instructor_id === $user->id) {
            return true;
        }

        if ($class->program->program_head_id === $user->id) {
            return true;
        }

        return $class->enrollments()->where('student_id', $user->id)->exists();
    }

    public function create(User $user): bool
    {
        return $user->role === 'administrator';
    }

    public function update(User $user, ClassModel $class): bool
    {
        return $user->role === 'administrator';
    }

    public function delete(User $user, ClassModel $class): bool
    {
        return $user->role === 'administrator';
    }
}