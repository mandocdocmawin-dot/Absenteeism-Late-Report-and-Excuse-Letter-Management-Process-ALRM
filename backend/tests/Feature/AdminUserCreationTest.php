<?php

namespace Tests\Feature;

use App\Models\Enrollment;
use App\Models\Program;
use App\Models\User;
use App\Services\AcademicPeriod;
use App\Services\AuditLoggerService;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\SecurityTestCase;

class AdminUserCreationTest extends SecurityTestCase
{
    private function payload(string $role = 'student', array $overrides = []): array
    {
        $domain = $role === 'student' ? 'student.edu.ph' : 'staff.edu.ph';

        return [
            'name' => 'Roster Name', 'email' => Str::uuid().'@'.$domain,
            'role' => $role, ...$overrides,
        ];
    }

    public function test_only_active_administrators_can_create_users(): void
    {
        $payload = $this->payload();
        $this->postJson('/api/admin/users', $payload)->assertUnauthorized();
        foreach (['student', 'instructor', 'program_head'] as $role) {
            $actor = $this->user($role);
            $this->assertFalse(Gate::forUser($actor)->allows('create', User::class));
            $this->bearer($actor)->postJson('/api/admin/users', $payload)->assertForbidden();
        }
        foreach (['pending', 'deactivated'] as $status) {
            $actor = $this->user('administrator', ['status' => $status]);
            $this->assertFalse(Gate::forUser($actor)->allows('create', User::class));
            $this->bearer($actor)->postJson('/api/admin/users', $payload)->assertForbidden();
        }
        $this->assertDatabaseMissing('users', ['email' => $payload['email']]);
    }

    public function test_each_role_is_created_with_its_correct_program_storage_and_audit(): void
    {
        $admin = $this->user('administrator');
        $this->assertTrue(Gate::forUser($admin)->allows('create', User::class));
        foreach (['student', 'instructor', 'program_head', 'administrator'] as $role) {
            $program = Program::factory()->create();
            $payload = $this->payload($role, ['school_id_number' => 'ID-'.$role]);
            if ($role !== 'administrator') {
                $payload['program_id'] = $program->id;
            }
            $response = $this->bearer($admin)->postJson('/api/admin/users', $payload)
                ->assertCreated()->assertJsonPath('data.role', $role)
                ->assertJsonPath('data.status', 'pending')
                ->assertJsonPath('data.school_id_number', 'ID-'.$role);
            $user = User::findOrFail($response->json('data.id'));
            $this->assertNull($user->password);
            $this->assertNull($user->google_id);
            $this->assertSame($role === 'student' ? $program->id : null, $user->program_id);
            $this->assertSame($role === 'instructor' ? [$program->id] : [], $user->programs()->pluck('programs.id')->all());
            $this->assertSame($role === 'program_head' ? $user->id : null, $program->fresh()->program_head_id);
            $response->assertJsonPath('data.heads_program', $role === 'program_head');
            $this->assertDatabaseHas('audit_log', ['action' => 'pre_registered_user:'.$role, 'record_id' => $user->id]);
        }
    }

    public function test_name_parts_are_combined_and_email_is_normalized_before_uniqueness_checks(): void
    {
        $admin = $this->user('administrator');
        $payload = $this->payload('student', [
            'name' => null, 'first_name' => ' Maria ', 'middle_name' => ' Santos ',
            'last_name' => ' Cruz ', 'email' => '  MARIA@STUDENT.EDU.PH  ',
        ]);
        $this->bearer($admin)->postJson('/api/admin/users', $payload)
            ->assertCreated()->assertJsonPath('data.name', 'Maria Santos Cruz')
            ->assertJsonPath('data.email', 'maria@student.edu.ph');
        $this->bearer($admin)->postJson('/api/admin/users', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->bearer($admin)->postJson('/api/admin/users', $this->payload('student', [
            'name' => null, 'first_name' => 'Maria', 'last_name' => 'Cruz',
        ]))->assertCreated()->assertJsonPath('data.name', 'Maria Cruz');
    }

    public function test_duplicate_and_invalid_school_ids_are_rejected_across_roles(): void
    {
        $admin = $this->user('administrator');
        $this->user('instructor', ['school_id_number' => 'EMP-001']);
        foreach (['EMP-001', str_repeat('a', 51), 123] as $id) {
            $this->bearer($admin)->postJson('/api/admin/users', $this->payload('student', ['school_id_number' => $id]))
                ->assertUnprocessable()->assertJsonValidationErrors('school_id_number');
        }
        $this->bearer($admin)->postJson('/api/admin/users', $this->payload('student', ['school_id_number' => str_repeat('0', 50)]))
            ->assertCreated();
    }

    public function test_legacy_roster_payloads_remain_valid_and_year_is_collected_at_completion(): void
    {
        $admin = $this->user('administrator');
        foreach (['student', 'instructor', 'program_head', 'administrator'] as $role) {
            $this->bearer($admin)->postJson('/api/admin/users', $this->payload($role))
                ->assertCreated()->assertJsonPath('data.program_id', null)
                ->assertJsonPath('data.school_id_number', null);
        }
        $this->bearer($admin)->postJson('/api/admin/users', $this->payload('student', ['year_level' => '1st']))
            ->assertUnprocessable()->assertJsonValidationErrors('year_level');
    }

    public function test_invalid_and_nonexistent_programs_and_administrator_programs_are_rejected(): void
    {
        $admin = $this->user('administrator');
        foreach (['bad-id', (string) Str::uuid()] as $id) {
            $this->bearer($admin)->postJson('/api/admin/users', $this->payload('student', ['program_id' => $id]))
                ->assertUnprocessable()->assertJsonValidationErrors('program_id');
        }
        $this->bearer($admin)->postJson('/api/admin/users', $this->payload('administrator', ['program_id' => Program::factory()->create()->id]))
            ->assertUnprocessable()->assertJsonValidationErrors('program_id');
    }

    public function test_noninstitutional_email_and_role_domain_mismatches_are_rejected(): void
    {
        $admin = $this->user('administrator');
        foreach ([
            ['student', 'user@gmail.com'], ['student', 'user@staff.edu.ph'],
            ['instructor', 'user@student.edu.ph'], ['program_head', 'user@student.edu.ph'],
            ['administrator', 'user@student.edu.ph'], ['student', 'user@student.edu.ph.evil.test'],
        ] as [$role, $email]) {
            $this->bearer($admin)->postJson('/api/admin/users', $this->payload($role, ['email' => $email]))
                ->assertUnprocessable();
            $this->assertDatabaseMissing('users', ['email' => $email]);
        }
    }

    public function test_existing_program_head_is_never_replaced_by_creation(): void
    {
        $head = $this->user('program_head');
        $program = Program::factory()->create(['program_head_id' => $head->id]);
        $payload = $this->payload('program_head', ['program_id' => $program->id]);
        $this->bearer($this->user('administrator'))->postJson('/api/admin/users', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('program_id');
        $this->assertSame($head->id, $program->fresh()->program_head_id);
        $this->assertDatabaseMissing('users', ['email' => $payload['email']]);
    }

    public function test_creation_and_all_assignments_roll_back_when_audit_fails(): void
    {
        $admin = $this->user('administrator');
        $this->mock(AuditLoggerService::class, function ($mock) {
            $mock->shouldReceive('log')->times(3)->andThrow(new RuntimeException('Simulated audit failure'));
        });
        foreach (['student', 'instructor', 'program_head'] as $role) {
            $program = Program::factory()->create();
            $payload = $this->payload($role, ['program_id' => $program->id]);
            $this->bearer($admin)->postJson('/api/admin/users', $payload)->assertStatus(500);
            $this->assertDatabaseMissing('users', ['email' => $payload['email']]);
            $this->assertDatabaseMissing('program_user', ['program_id' => $program->id]);
            $this->assertNull($program->fresh()->program_head_id);
        }
    }

    public function test_admin_list_returns_instructor_program_membership(): void
    {
        $admin = $this->user('administrator');
        $program = Program::factory()->create();
        $instructor = $this->user('instructor');
        $instructor->programs()->attach($program);
        $response = $this->bearer($admin)->getJson('/api/admin/users?role=instructor')->assertOk();
        $response->assertJsonPath('data.0.programs.0.id', $program->id);
    }

    public function test_preassigned_student_can_submit_only_year_and_is_auto_enrolled(): void
    {
        $class = $this->requestFor($this->user())->enrollment->class;
        $class->update(['semester' => AcademicPeriod::semester(), 'school_year' => AcademicPeriod::schoolYear()]);
        $payload = $this->payload('student', ['program_id' => $class->program_id, 'school_id_number' => '000-123']);
        $id = $this->bearer($this->user('administrator'))->postJson('/api/admin/users', $payload)
            ->assertCreated()->assertJsonPath('data.year_level', null)->json('data.id');
        $student = User::findOrFail($id);
        $student->update(['status' => 'approved']);

        $this->bearer($student)->postJson('/api/complete-profile', ['year_level' => '1st'])
            ->assertOk()->assertJsonPath('data.program_id', $class->program_id)
            ->assertJsonPath('data.school_id_number', '000-123')->assertJsonPath('data.year_level', '1st');
        $this->assertDatabaseHas('enrollments', ['student_id' => $id, 'class_id' => $class->id]);
        $this->bearer($student)->postJson('/api/complete-profile', ['year_level' => '2nd'])->assertStatus(409);
    }

    public function test_partial_completion_cannot_replace_or_clear_admin_assigned_fields(): void
    {
        $program = Program::factory()->create();
        $student = $this->user('student', ['program_id' => $program->id, 'school_id_number' => 'LOCKED']);
        foreach ([
            ['program_id' => Program::factory()->create()->id], ['school_id_number' => 'NEW'],
            ['program_id' => null], ['school_id_number' => null], ['year_level' => '5th'],
        ] as $fields) {
            $this->bearer($student)->postJson('/api/complete-profile', $fields + ['year_level' => '1st'])
                ->assertUnprocessable();
        }
        $this->bearer($student)->postJson('/api/complete-profile', [])
            ->assertUnprocessable()->assertJsonValidationErrors('year_level');
        $this->assertNull($student->fresh()->year_level);
        $this->assertSame($program->id, $student->fresh()->program_id);
        $this->assertSame('LOCKED', $student->fresh()->school_id_number);
        $this->assertSame(0, Enrollment::where('student_id', $student->id)->count());
    }
}
