<?php

namespace Tests\Feature;

use App\Models\Program;
use App\Models\User;
use Tests\SecurityTestCase;

class AdminProgramStudentCountTest extends SecurityTestCase
{
    public function test_program_student_counts_use_the_student_program_instead_of_staff_memberships(): void
    {
        $first = Program::factory()->create();
        $second = Program::factory()->create();
        $empty = Program::factory()->create();
        $students = User::factory()->count(20)->create([
            'role' => 'student', 'status' => 'approved', 'program_id' => $first->id,
        ]);
        User::factory()->count(9)->create([
            'role' => 'student', 'status' => 'approved', 'program_id' => $second->id,
        ]);
        $instructor = $this->user('instructor', ['program_id' => $first->id]);
        $first->users()->attach($instructor->id);
        // A legacy pivot membership must neither duplicate nor relocate a student.
        $first->users()->attach($students->first()->id);
        $empty->users()->attach($students->first()->id);

        $response = $this->bearer($this->user('administrator'))
            ->getJson('/api/admin/dashboard')
            ->assertOk()->assertJsonPath('data.total_students', 29);
        $programs = collect($response->json('data.programs_summary'))->keyBy('id');

        $this->assertSame(20, $programs[$first->id]['student_count']);
        $this->assertSame(9, $programs[$second->id]['student_count']);
        $this->assertSame(0, $programs[$empty->id]['student_count']);
    }
}
