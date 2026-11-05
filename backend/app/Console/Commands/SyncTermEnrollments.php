<?php

namespace App\Console\Commands;

use App\Models\ClassModel;
use App\Models\Enrollment;
use App\Models\User;
use App\Services\AcademicPeriod;
use Illuminate\Console\Command;

class SyncTermEnrollments extends Command
{
    protected $signature = 'enroll:sync-term';
    protected $description = 'Enroll matching students into all classes of the current academic term';

    public function handle(): int
    {
        $semester   = AcademicPeriod::semester();
        $schoolYear = AcademicPeriod::schoolYear();
        $created    = 0;

        $classes = ClassModel::query()
            ->where('semester', $semester)
            ->where('school_year', $schoolYear)
            ->whereNotNull('year_level')
            ->get();

        foreach ($classes as $class) {
            User::query()
                ->where('role', 'student')
                ->where('program_id', $class->program_id)
                ->where('year_level', $class->year_level)
                ->chunkById(200, function ($students) use ($class, &$created) {
                    foreach ($students as $student) {
                        $enrollment = Enrollment::firstOrCreate(
                            ['student_id' => $student->id, 'class_id' => $class->id],
                            ['year_level' => $class->year_level],
                        );

                        if ($enrollment->wasRecentlyCreated) {
                            $created++;
                        }
                    }
                });
        }

        $this->info("Term {$semester} {$schoolYear}: {$created} new enrollment(s) from {$classes->count()} class(es).");

        return self::SUCCESS;
    }
}