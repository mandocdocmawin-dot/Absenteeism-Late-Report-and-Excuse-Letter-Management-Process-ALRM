<?php

namespace Tests\Feature;

use App\Models\Enrollment;
use App\Models\Program;
use App\Services\AcademicPeriod;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\SecurityTestCase;

class SchoolIdNumberTest extends SecurityTestCase
{
    public function test_student_completion_saves_the_new_field_and_still_auto_enrolls(): void
    {
        $student = $this->user();
        $request = $this->requestFor($this->user());
        $class = $request->enrollment->class;
        $class->update(['semester' => AcademicPeriod::semester(), 'school_year' => AcademicPeriod::schoolYear()]);

        $response = $this->bearer($student)->postJson('/api/complete-profile', [
            'program_id' => $class->program_id, 'school_id_number' => '001-0023', 'year_level' => '1st',
        ])->assertOk()->assertJsonPath('data.school_id_number', '001-0023');
        $this->assertArrayNotHasKey('school_student_id', $response->json('data'));
        $this->assertSame('001-0023', $student->fresh()->school_id_number);
        $this->assertDatabaseHas('enrollments', ['student_id' => $student->id, 'class_id' => $class->id]);
        $this->bearer($student)->getJson('/api/me')->assertOk()->assertJsonPath('data.school_id_number', '001-0023');
        $this->bearer($student)->postJson('/api/complete-profile', [
            'program_id' => $class->program_id, 'school_id_number' => 'changed', 'year_level' => '2nd',
        ])->assertStatus(409);
        $this->assertSame('001-0023', $student->fresh()->school_id_number);
    }

    public function test_all_staff_roles_can_save_ids_without_year_levels_and_keep_existing_programs(): void
    {
        $oldProgram = Program::factory()->create();
        $newProgram = Program::factory()->create();
        foreach (['instructor', 'program_head', 'administrator'] as $role) {
            $staff = $this->user($role);
            $staff->programs()->attach($oldProgram);

            $this->bearer($staff)->postJson('/api/complete-profile', [
                'program_id' => $newProgram->id, 'school_id_number' => '000-'.$role,
            ])->assertOk()->assertJsonPath('data.school_id_number', '000-'.$role);
            $this->assertSame('000-'.$role, $staff->fresh()->school_id_number);
            $this->assertSame(2, $staff->programs()->count());
            $this->assertSame(0, Enrollment::where('student_id', $staff->id)->count());
            $this->assertSame($role, $staff->fresh()->role);

            // Existing clients may link programs without submitting a staff ID.
            $this->bearer($staff)->postJson('/api/complete-profile', [
                'program_id' => $oldProgram->id,
            ])->assertOk()->assertJsonPath('data.school_id_number', '000-'.$role);
        }
    }

    public function test_new_id_validation_requires_student_ids_and_rejects_duplicates_across_roles(): void
    {
        $program = Program::factory()->create();
        $student = $this->user();
        $payload = ['program_id' => $program->id, 'year_level' => '1st'];
        $this->bearer($student)->postJson('/api/complete-profile', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('school_id_number');

        $this->user('instructor', ['school_id_number' => 'EMP-001']);
        foreach (['EMP-001', str_repeat('a', 51), 1234] as $invalidId) {
            $this->bearer($student)->postJson('/api/complete-profile', $payload + ['school_id_number' => $invalidId])
                ->assertUnprocessable()->assertJsonValidationErrors('school_id_number');
        }
        $staff = $this->user('instructor', ['school_id_number' => 'EMP-002']);
        $this->bearer($staff)->postJson('/api/complete-profile', [
            'program_id' => $program->id, 'school_id_number' => 'EMP-002',
        ])->assertOk();
        $this->assertSame(0, $student->programs()->count());
    }

    public function test_migration_and_rollback_preserve_existing_ids_and_database_uniqueness(): void
    {
        $user = $this->user('student', ['school_id_number' => '000-123']);
        $migration = require database_path('migrations/2026_10_29_000000_rename_school_student_id_to_school_id_number.php');
        $migration->down();
        $this->assertTrue(Schema::hasColumn('users', 'school_student_id'));
        $this->assertSame('000-123', DB::table('users')->where('id', $user->id)->value('school_student_id'));
        $migration->up();
        $this->assertFalse(Schema::hasColumn('users', 'school_student_id'));
        $this->assertSame('000-123', $user->fresh()->school_id_number);

        $this->expectException(QueryException::class);
        $this->user('instructor', ['school_id_number' => '000-123']);
    }
}
