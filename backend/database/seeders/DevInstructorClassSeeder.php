<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\ClassModel;
use App\Models\Enrollment;
use App\Models\Program;
use App\Models\User;
use App\Services\TeachingAssignmentService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DevInstructorClassSeeder extends Seeder
{
    public const string DEV_HOME_PROGRAM_NAME = 'Bachelor of Science in Information System';

    public const array DEV_INSTRUCTOR_EMAILS = User::STUDENT_INSTRUCTOR_EMAILS;

    // Stable, distinct subjects shared across all degree programs.
    private const array SUBJECTS_BY_EMAIL = [
        'marwin.mandocdoc@student.laverdad.edu.ph' => 'Digital Citizenship and Online Safety',
        'macrobert.savandal@student.laverdad.edu.ph' => 'Financial Literacy and Personal Management',
        'jimueljarina@student.laverdad.edu.ph' => 'Critical Thinking and Creative Problem Solving',
        'ranceljoycuervo@student.laverdad.edu.ph' => 'Community Leadership and Volunteerism',
    ];

    public function run(): void
    {
        $devs = User::query()->whereIn('email', self::DEV_INSTRUCTOR_EMAILS)->get();
        $missing = array_values(array_diff(self::DEV_INSTRUCTOR_EMAILS, $devs->pluck('email')->all()));

        if ($missing !== []) {
            $msg = 'DevInstructorClassSeeder: dev user(s) not found, run AdminUserSeeder first: '.implode(', ', $missing);
            Log::warning($msg);
            $this->command?->warn($msg);
        }

        if ($devs->isEmpty()) {
            return;
        }

        $programIds = Program::query()
            ->where('program_name', '!=', 'General Education')
            ->pluck('id');
        $homeProgramId = Program::query()
            ->where('program_name', self::DEV_HOME_PROGRAM_NAME)
            ->firstOrFail()->id;
        $devIds = $devs->pluck('id')->all();

        // Use every existing section, even before its first student enrolls.
        $groups = ClassModel::query()
            ->whereIn('program_id', $programIds)
            ->orderBy('subject_name')
            ->get()
            ->groupBy(fn (ClassModel $class) => implode('|', [
                $class->program_id,
                $class->year_level,
                $class->semester,
                $class->school_year,
                $class->section,
            ]));

        $enrollmentsAdded = DB::transaction(function () use ($devs, $devIds, $programIds, $homeProgramId, $groups): int {
            foreach ($devs as $dev) {
                $dev->programs()->sync($programIds->all());

                // Their student/home program stays BSIS; teaching membership spans all six programs.
                if ($dev->program_id !== $homeProgramId) {
                    $dev->update(['program_id' => $homeProgramId]);
                }
            }

            $added = 0;

            foreach ($groups as $group) {
                $context = $group->first()->only([
                    'program_id', 'year_level', 'semester', 'school_year', 'section',
                ]);
                $originals = $group->reject(fn (ClassModel $class) => in_array($class->instructor_id, $devIds, true));
                $students = Enrollment::query()
                    ->whereIn('class_id', $group->pluck('id'))
                    ->get()
                    ->unique('student_id');

                foreach ($devs as $dev) {
                    $subject = self::SUBJECTS_BY_EMAIL[$dev->email];
                    $source = $originals->firstWhere('subject_name', $subject);
                    $existingClasses = $group->where('instructor_id', $dev->id);
                    $existing = $existingClasses->firstWhere('subject_name', $subject) ?? $existingClasses->first();
                    if ($existing && $existing->subject_name !== $subject && $existing->requests()->exists()) {
                        app(TeachingAssignmentService::class)->change($existing->id, [
                            'action' => 'remove', 'expected_revision' => $existing->assignment_revision,
                            'reason' => 'Dev timetable subject replacement; preserve existing request history',
                        ]);
                        $existing = null;
                    }
                    $copy = $existing ?? new ClassModel([...$context, 'instructor_id' => $dev->id]);
                    $schedule = $source?->schedule;
                    if (! is_array($schedule) || $schedule === []) {
                        // Keep an entered timetable only when it belongs to this subject.
                        $schedule = $existing?->subject_name === $subject ? ($existing->schedule ?? []) : [];
                    }
                    $copy->fill([
                        'subject_name' => $subject,
                        'schedule' => $schedule,
                    ])->save();

                    foreach ($students as $enrollment) {
                        if ($enrollment->student_id === $dev->id) {
                            continue;
                        }

                        $newEnrollment = Enrollment::firstOrCreate([
                            'student_id' => $enrollment->student_id,
                            'class_id' => $copy->id,
                        ], ['year_level' => $enrollment->year_level]);

                        $added += (int) $newEnrollment->wasRecentlyCreated;
                    }
                }
            }

            return $added;
        });

        $programsWithoutClasses = $programIds->diff(
            $groups->map(fn ($group) => $group->first()->program_id),
        );

        if ($programsWithoutClasses->isNotEmpty()) {
            $this->command?->warn('Some programs have no class data yet. Run ClassSeeder to import their sections before syncing dev classes.');
        }

        Log::info('DevInstructorClassSeeder: dev classes synced', [
            'dev_users' => $devs->count(),
            'sections' => $groups->count(),
            'enrollments_added' => $enrollmentsAdded,
            'programs_without_classes' => $programsWithoutClasses->values()->all(),
        ]);

        $this->command?->info("Dev classes synced: {$devs->count()} instructor(s) x {$groups->count()} section(s), {$enrollmentsAdded} enrollment(s) added.");
    }
}
