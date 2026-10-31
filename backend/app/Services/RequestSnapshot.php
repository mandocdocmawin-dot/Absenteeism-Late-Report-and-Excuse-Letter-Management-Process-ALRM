<?php

namespace App\Services;

use App\Models\ClassModel;
use App\Models\TeachingAssignment;

class RequestSnapshot
{
    public static function capture(ClassModel $class, TeachingAssignment $assignment): array
    {
        $class->loadMissing('program');
        $assignment->loadMissing('instructor');

        return [
            'teaching_assignment_id' => $assignment->id,
            'snapshot_source' => 'submission',
            'class_snapshot' => [
                ...$class->only([
                    'id', 'subject_name', 'program_id', 'section', 'year_level', 'semester',
                    'school_year', 'curriculum_subject_id', 'schedule', 'weekly_hours',
                    'meetings_per_week', 'credit_units',
                ]),
                'instructor_id' => $assignment->instructor_id,
                'instructor' => $assignment->instructor->only(['id', 'name']),
                'program' => $class->program?->only(['id', 'program_name']),
            ],
        ];
    }
}
