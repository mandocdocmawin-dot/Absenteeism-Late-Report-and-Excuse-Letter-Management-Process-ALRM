<?php

namespace Tests\Feature;

use App\Models\ClassModel;
use App\Models\Program;
use App\Models\User;
use Database\Seeders\DevInstructorClassSeeder;
use Database\Seeders\DevInstructorScheduleSeeder;
use Tests\SecurityTestCase;

class DevInstructorScheduleTest extends SecurityTestCase
{
    public function test_84_sample_schedules_are_distinct_per_instructor_and_section_and_survive_roster_sync(): void
    {
        $program = Program::factory()->create(['program_name' => DevInstructorClassSeeder::DEV_HOME_PROGRAM_NAME]);
        foreach (DevInstructorClassSeeder::DEV_INSTRUCTOR_EMAILS as $email) {
            $this->user('instructor', ['email' => $email]);
        }
        $sourceSchedule = [['day' => 'Mon', 'start' => '08:00', 'end' => '09:00', 'room' => 'Original']];
        for ($i = 1; $i <= 21; $i++) {
            ClassModel::create([
                'program_id' => $program->id, 'subject_name' => 'Original subject',
                'year_level' => '1st', 'section' => 'Section '.$i, 'semester' => '1st',
                'school_year' => '2026-2027', 'schedule' => $sourceSchedule,
            ]);
        }
        $this->seed(DevInstructorClassSeeder::class);
        $this->seed(DevInstructorScheduleSeeder::class);

        $devIds = User::whereIn('email', DevInstructorClassSeeder::DEV_INSTRUCTOR_EMAILS)->pluck('id');
        $classes = ClassModel::whereIn('instructor_id', $devIds)->get();
        $this->assertCount(84, $classes);
        $slotKey = fn ($c) => $c->schedule[0]['day'].'|'.$c->schedule[0]['start'];
        foreach ($classes->groupBy('instructor_id') as $group) {
            $this->assertCount(21, $group->map($slotKey)->unique());
        }
        foreach ($classes->groupBy('section') as $group) {
            $this->assertCount(4, $group->map($slotKey)->unique());
        }
        foreach ($classes as $class) {
            $this->assertSame(3, $class->weekly_hours);
            $this->assertSame(1, $class->meetings_per_week);
            $this->assertStringStartsWith('TEST-', $class->schedule[0]['room']);
        }
        $before = $classes->mapWithKeys(fn ($c) => [$c->id => $c->schedule])->all();
        $this->seed(DevInstructorClassSeeder::class);
        $this->seed(DevInstructorScheduleSeeder::class);
        $this->assertSame($before, ClassModel::whereIn('instructor_id', $devIds)->get()->mapWithKeys(fn ($c) => [$c->id => $c->schedule])->all());
        $this->assertTrue(ClassModel::whereNull('instructor_id')->get()->every(fn ($c) => $c->schedule === $sourceSchedule));
    }
}
