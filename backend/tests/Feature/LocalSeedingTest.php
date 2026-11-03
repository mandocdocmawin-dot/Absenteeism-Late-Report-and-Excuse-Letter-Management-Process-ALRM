<?php

namespace Tests\Feature;

use App\Models\ClassModel;
use App\Models\Program;
use Database\Seeders\AdminUserSeeder;
use Database\Seeders\ProgramSeeder;
use Illuminate\Support\Facades\Artisan;
use Tests\SecurityTestCase;

class LocalSeedingTest extends SecurityTestCase
{
    public function test_local_account_seeding_preserves_unlisted_staff_heads_and_classes(): void
    {
        $this->seed(ProgramSeeder::class);
        $program = Program::where('program_name', 'Bachelor of Science in Information System')->sole();
        $head = $this->user('program_head', ['program_id' => $program->id]);
        $program->update(['program_head_id' => $head->id]);
        $instructor = $this->user('instructor');
        $inactive = $this->user('instructor', ['status' => 'deactivated']);
        $schedule = [['day' => 'Mon', 'start' => '08:00', 'end' => '11:00', 'room' => '101']];
        $class = ClassModel::create([
            'subject_name' => 'Existing subject', 'program_id' => $program->id,
            'instructor_id' => $instructor->id, 'year_level' => '1st',
            'semester' => '1st', 'school_year' => '2026-2027', 'schedule' => $schedule,
        ]);

        $this->seed(AdminUserSeeder::class);
        $userCount = \App\Models\User::count();
        $this->seed(AdminUserSeeder::class);

        $this->assertSame($userCount, \App\Models\User::count());
        $this->assertSame('approved', $instructor->fresh()->status);
        $this->assertSame('deactivated', $inactive->fresh()->status);
        $this->assertSame($head->id, $program->fresh()->program_head_id);
        $this->assertSame($instructor->id, $class->fresh()->instructor_id);
        $this->assertSame($schedule, $class->fresh()->schedule);
        $this->assertSame(1, ClassModel::count());
        $this->assertDatabaseHas('users', [
            'email' => 'jaderiel.abuela@laverdad.edu.ph', 'role' => 'administrator',
        ]);
    }

    public function test_removed_sync_commands_are_not_registered(): void
    {
        $commands = Artisan::all();

        $this->assertArrayNotHasKey('roster:sync', $commands);
        $this->assertArrayNotHasKey('enroll:sync-term', $commands);
    }
}
