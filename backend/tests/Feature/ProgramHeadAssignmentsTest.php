<?php

namespace Tests\Feature;

use App\Models\Program;
use App\Models\User;
use Tests\SecurityTestCase;

class ProgramHeadAssignmentsTest extends SecurityTestCase
{
    public function test_admin_only_changes_role_to_grant_current_program_access_to_multiple_testers(): void
    {
        $admin = $this->user('administrator');
        $primary = $this->user('program_head');
        $program = Program::factory()->create(['program_head_id' => $primary->id]);
        $otherProgram = Program::factory()->create();
        $student = $this->user('student', ['program_id' => $program->id]);
        $outsider = $this->user('student', ['program_id' => $otherProgram->id]);

        foreach (['student', 'instructor'] as $role) {
            $tester = $this->user($role, ['program_id' => $program->id]);
            $tester->programs()->attach($otherProgram);

            $this->bearer($admin)->patchJson('/api/admin/users/'.$tester->id.'/role', ['role' => 'program_head'])
                ->assertOk()->assertJsonPath('message', 'Role updated.')
                ->assertJsonPath('data.heads_program', true);

            $this->assertSame([$program->id], $tester->fresh()->headedProgramIds());
            $this->bearer($tester->fresh())->getJson('/api/program-head/students')->assertOk()
                ->assertJsonFragment(['id' => $student->id])->assertJsonMissing(['id' => $outsider->id]);
        }

        $this->assertSame($primary->id, $program->fresh()->program_head_id);
        $this->assertDatabaseCount('program_head_assignments', 0);
    }

    public function test_database_role_edits_follow_current_program_and_stop_on_demotion(): void
    {
        $first = Program::factory()->create();
        $second = Program::factory()->create();
        $tester = $this->user('student', ['program_id' => $first->id]);
        $this->assertSame([], $tester->headedProgramIds());

        // Query-builder updates bypass model events, like direct SQL edits.
        User::whereKey($tester->id)->update(['role' => 'program_head']);
        $this->assertSame([$first->id], $tester->fresh()->headedProgramIds());
        $this->bearer($tester->fresh())->getJson('/api/program-head/dashboard')->assertOk();

        $tester->update(['program_id' => $second->id]);
        $this->assertSame([$second->id], $tester->fresh()->headedProgramIds());

        $this->bearer($this->user('administrator'))->patchJson('/api/admin/users/'.$tester->id.'/role', ['role' => 'instructor'])
            ->assertOk()->assertJsonPath('data.heads_program', false);
        $this->bearer($tester->fresh())->getJson('/api/program-head/dashboard')->assertForbidden();
    }

    public function test_promotion_without_current_program_does_not_guess_teaching_membership(): void
    {
        $tester = $this->user('instructor', ['program_id' => null]);
        $tester->programs()->attach(Program::factory()->create());
        $this->bearer($this->user('administrator'))->patchJson('/api/admin/users/'.$tester->id.'/role', ['role' => 'program_head'])
            ->assertOk()->assertJsonPath('data.heads_program', false)
            ->assertJsonPath('message', 'Role updated. Paalala: wala pang program na naka-assign sa user na ito. Itakda ito sa Programs.');
        $this->bearer($tester->fresh())->getJson('/api/program-head/dashboard')->assertForbidden();
    }

    public function test_student_cannot_promote_an_account_to_program_head(): void
    {
        $tester = $this->user('student', ['program_id' => Program::factory()->create()->id]);
        $this->bearer($tester)->patchJson('/api/admin/users/'.$tester->id.'/role', ['role' => 'program_head'])->assertForbidden();
        $this->assertSame('student', $tester->fresh()->role);
    }

    public function test_two_co_heads_can_read_bs_is_accounts_without_access_to_other_programs(): void
    {
        $primary = $this->user('program_head');
        $program = Program::factory()->create(['program_head_id' => $primary->id]);
        $heads = [$this->user('program_head'), $this->user('instructor')];
        $student = $this->user('student', ['program_id' => $program->id]);
        $outsider = $this->user('student');
        $ownRequest = $this->requestFor($student);
        $ownRequest->enrollment->class->update(['program_id' => $program->id]);
        $instructor = $ownRequest->enrollment->class->instructor;
        $otherRequest = $this->requestFor($outsider);
        $unrelated = $this->user('instructor');

        $this->artisan('alrm:assign-program-heads', ['program' => $program->id, 'users' => array_map(fn ($head) => $head->id, $heads)])->assertSuccessful();
        $this->assertSame($primary->id, $program->fresh()->program_head_id);
        $this->assertSame('instructor', $unrelated->fresh()->role);

        foreach ($heads as $head) {
            $head = $head->fresh();
            $this->assertSame('program_head', $head->role);
            $this->bearer($head)->getJson('/api/me')->assertOk()->assertJsonPath('data.heads_program', true);
            $this->bearer($head)->getJson('/api/program-head/dashboard')->assertOk()
                ->assertJsonPath('data.total_students', 1)->assertJsonPath('data.total_instructors', 1);
            $this->bearer($head)->getJson('/api/program-head/students')->assertOk()
                ->assertJsonFragment(['id' => $student->id])->assertJsonMissing(['id' => $outsider->id]);
            $this->bearer($head)->getJson('/api/program-head/instructors')->assertOk()
                ->assertJsonFragment(['id' => $instructor->id])->assertJsonMissing(['id' => $unrelated->id]);
            $this->bearer($head)->getJson('/api/program-head/requests')->assertOk()
                ->assertJsonFragment(['id' => $ownRequest->id])->assertJsonMissing(['id' => $otherRequest->id]);
            $this->assertTrue($head->can('view', $ownRequest));
            $this->assertFalse($head->can('view', $otherRequest));
        }
    }

    public function test_teaching_membership_does_not_grant_head_access(): void
    {
        $instructor = $this->user('instructor');
        $instructor->programs()->attach(Program::factory()->create());
        $this->bearer($instructor)->getJson('/api/program-head/students')->assertForbidden();
    }

    public function test_assignment_rejects_students_without_partial_changes(): void
    {
        $staff = $this->user('instructor');
        $student = $this->user('student');
        $this->artisan('alrm:assign-program-heads', [
            'program' => Program::factory()->create()->id, 'users' => [$staff->id, $student->id],
        ])->assertFailed();
        $this->assertSame('instructor', $staff->fresh()->role);
        $this->assertDatabaseCount('program_head_assignments', 0);
    }
}
