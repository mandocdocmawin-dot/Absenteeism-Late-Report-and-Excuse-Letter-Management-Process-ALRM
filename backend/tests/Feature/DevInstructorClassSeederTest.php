<?php

namespace Tests\Feature;

use App\Models\ClassModel;
use App\Models\Enrollment;
use App\Models\Program;
use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Database\Seeders\DevInstructorClassSeeder;
use Database\Seeders\ProgramSeeder;
use Database\Seeders\SeedUser;
use Database\Seeders\UserRole;
use Tests\SecurityTestCase;

class DevInstructorClassSeederTest extends SecurityTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(ProgramSeeder::class);
    }

    public function test_all_four_instructors_have_distinct_subjects_in_every_program_and_empty_section(): void
    {
        $devs = collect(DevInstructorClassSeeder::DEV_INSTRUCTOR_EMAILS)->map(fn ($email) => User::create([
            'email' => $email, 'name' => $email, 'role' => 'instructor',
        ]));
        $programs = Program::where('program_name', '!=', 'General Education')->get();
        $this->assertCount(6, $programs);
        $originalIds = [];
        $oldClass = null;
        $oldEnrollment = null;

        foreach ($programs as $index => $program) {
            $class = ClassModel::create([
                'subject_name' => 'Applications Development and Emerging Technologies 1',
                'program_id' => $program->id,
                'year_level' => '1st',
                'semester' => '1st',
                'school_year' => '2026-2027',
                'section' => 'Section A',
                'schedule' => [['day' => 'Mon', 'start' => '08:00', 'end' => '09:00', 'room' => null]],
            ]);
            $originalIds[] = $class->id;

            // Five programs have no enrollments at all yet.
            if ($index !== 0) {
                continue;
            }

            $student = User::create(['name' => 'Student', 'email' => 'student@example.com', 'role' => 'student']);
            Enrollment::create(['student_id' => $student->id, 'class_id' => $class->id, 'year_level' => '1st']);
            $oldClass = ClassModel::create([
                ...$class->only(['subject_name', 'program_id', 'year_level', 'semester', 'school_year', 'section', 'schedule']),
                'instructor_id' => $devs->first()->id,
            ]);
            $oldEnrollment = Enrollment::create(['student_id' => $student->id, 'class_id' => $oldClass->id, 'year_level' => '1st']);
        }

        $this->seed(DevInstructorClassSeeder::class);

        foreach ($programs as $program) {
            $classes = ClassModel::where('program_id', $program->id)->whereIn('instructor_id', $devs->pluck('id'))->get();
            $this->assertCount(4, $classes);
            $this->assertCount(4, $classes->pluck('subject_name')->unique());
            $this->assertEqualsCanonicalizing($devs->pluck('id')->all(), $classes->pluck('instructor_id')->all());
            $this->assertTrue($classes->every(fn ($class) => $class->schedule === []));
        }

        foreach ($devs as $dev) {
            $this->assertCount(6, $dev->programs);
            $this->assertSame(DevInstructorClassSeeder::DEV_HOME_PROGRAM_NAME, $dev->fresh()->program->program_name);
            $this->assertSame(1, ClassModel::where('instructor_id', $dev->id)->distinct()->count('subject_name'));
        }

        $this->assertSame('Digital Citizenship and Online Safety', $oldClass->fresh()->subject_name);
        $this->assertNotNull($oldEnrollment->fresh());
        $this->assertSame(5, Enrollment::count());
        $this->assertSame(6, ClassModel::whereIn('id', $originalIds)->whereNull('instructor_id')->count());

        $classIds = ClassModel::pluck('id')->sort()->values()->all();
        $enrollmentIds = Enrollment::pluck('id')->sort()->values()->all();
        $this->seed(DevInstructorClassSeeder::class);
        $this->assertSame($classIds, ClassModel::pluck('id')->sort()->values()->all());
        $this->assertSame($enrollmentIds, Enrollment::pluck('id')->sort()->values()->all());
    }

    public function test_missing_instructors_and_programs_without_classes_do_not_prevent_global_membership(): void
    {
        $dev = User::create([
            'name' => 'Marwin',
            'email' => DevInstructorClassSeeder::DEV_INSTRUCTOR_EMAILS[0],
            'role' => 'instructor',
        ]);
        $dev->programs()->attach(Program::where('program_name', 'General Education')->sole()->id);
        $dev->update(['program_id' => Program::where('program_name', 'General Education')->sole()->id]);

        $this->seed(DevInstructorClassSeeder::class);

        $this->assertCount(6, $dev->programs);
        $this->assertFalse($dev->programs->contains('program_name', 'General Education'));
        $this->assertSame(DevInstructorClassSeeder::DEV_HOME_PROGRAM_NAME, $dev->fresh()->program->program_name);
        $this->assertSame(0, ClassModel::count());
    }

    public function test_matching_subject_schedule_and_academic_sections_are_preserved(): void
    {
        $dev = User::create([
            'name' => 'Marwin',
            'email' => DevInstructorClassSeeder::DEV_INSTRUCTOR_EMAILS[0],
            'role' => 'instructor',
        ]);
        $program = Program::where('program_name', 'Associate in Computer Technology')->sole();
        $schedule = [['day' => 'Tue', 'start' => '10:00', 'end' => '11:00', 'room' => '101']];

        foreach (['1st', '2nd'] as $semester) {
            ClassModel::create([
                'subject_name' => 'Digital Citizenship and Online Safety',
                'program_id' => $program->id,
                'year_level' => '2nd',
                'semester' => $semester,
                'school_year' => '2026-2027',
                'section' => 'ACT 2',
                'schedule' => $schedule,
            ]);
        }

        $this->seed(DevInstructorClassSeeder::class);

        $classes = $dev->classesTaught()->get();
        $this->assertCount(2, $classes);
        $this->assertEqualsCanonicalizing(['1st', '2nd'], $classes->pluck('semester')->all());
        foreach ($classes as $class) {
            $this->assertSame($schedule, $class->schedule);
            $this->assertSame('ACT 2', $class->section);
            $this->assertSame('2nd', $class->year_level);
        }
    }

    public function test_global_sync_keeps_bsis_as_home_program_even_when_dev_accounts_are_students(): void
    {
        $socialWorkId = Program::where('program_name', 'Bachelor of Science in Social Work')->sole()->id;
        $devs = collect(DevInstructorClassSeeder::DEV_INSTRUCTOR_EMAILS)->map(fn ($email) => User::create([
            'email' => $email,
            'name' => $email,
            'role' => 'student',
            'program_id' => $socialWorkId,
        ]));

        $this->seed(DevInstructorClassSeeder::class);

        foreach ($devs as $dev) {
            $dev->refresh();
            $this->assertSame('student', $dev->role);
            $this->assertSame(DevInstructorClassSeeder::DEV_HOME_PROGRAM_NAME, $dev->program->program_name);
            $this->assertCount(6, $dev->programs);
        }
    }

    public function test_admin_user_seeding_saves_bsis_as_dev_home_without_changing_other_staff_defaults(): void
    {
        // Exercise persistence without calling the external Google Sheets roster.
        $seeder = new AdminUserSeeder;
        $saveUser = new \ReflectionMethod(AdminUserSeeder::class, 'saveUser');
        $programIds = Program::where('program_name', '!=', 'General Education')->pluck('id')->all();

        foreach (DevInstructorClassSeeder::DEV_INSTRUCTOR_EMAILS as $email) {
            $saveUser->invoke($seeder, new SeedUser($email, $email, UserRole::Instructor, $programIds));
            $dev = User::where('email', $email)->sole();
            $this->assertSame(DevInstructorClassSeeder::DEV_HOME_PROGRAM_NAME, $dev->program->program_name);
            $this->assertCount(6, $dev->programs);
            $this->assertSame('instructor', $dev->role);
        }

        $saveUser->invoke($seeder, new SeedUser('Other Instructor', 'other@laverdad.edu.ph', UserRole::Instructor, $programIds));
        $this->assertSame($programIds[0], User::where('email', 'other@laverdad.edu.ph')->sole()->program_id);
    }
}
