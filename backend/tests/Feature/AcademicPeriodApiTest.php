<?php

namespace Tests\Feature;

use App\Models\AcademicTerm;
use App\Services\AcademicPeriod;
use Tests\SecurityTestCase;

class AcademicPeriodApiTest extends SecurityTestCase
{
    public function test_authentication_is_required_and_only_admin_can_update(): void
    {
        $payload = ['semester' => '2nd', 'school_year' => '2026-2027'];
        $this->getJson('/api/academic-period')->assertUnauthorized();
        $this->putJson('/api/admin/academic-period', $payload)->assertUnauthorized();

        foreach (['student', 'instructor', 'program_head'] as $role) {
            $this->bearer($this->user($role))->getJson('/api/academic-period')->assertOk();
            $this->putJson('/api/admin/academic-period', $payload)->assertForbidden();
        }

        $this->assertDatabaseCount('academic_terms', 0);
    }

    public function test_admin_can_create_and_edit_current_period_and_refresh_cached_reads(): void
    {
        config(['academic.current_semester' => '1st', 'academic.current_school_year' => '2026-2027']);
        $this->bearer($this->user('administrator'));
        $this->getJson('/api/academic-period')->assertJsonPath('data.semester', '1st');

        foreach (['2nd', '1st'] as $semester) {
            $payload = ['semester' => $semester, 'school_year' => '2026-2027'];
            $this->putJson('/api/admin/academic-period', $payload)->assertOk()->assertJsonPath('data', $payload);
            $this->getJson('/api/academic-period')->assertOk()->assertJsonPath('data', $payload);
            $this->assertSame($semester, AcademicPeriod::semester());
        }

        $this->assertDatabaseCount('academic_terms', 1);
        $this->assertDatabaseHas('audit_log', ['action' => 'updated_academic_period']);
    }

    public function test_reads_and_updates_use_the_active_term_and_leave_future_terms_unchanged(): void
    {
        $past = AcademicTerm::create(['semester' => '1st', 'school_year' => '2025-2026', 'starts_on' => today()->subYear()]);
        $current = AcademicTerm::create(['semester' => '1st', 'school_year' => '2026-2027', 'starts_on' => today()]);
        $future = AcademicTerm::create(['semester' => '2nd', 'school_year' => '2027-2028', 'starts_on' => today()->addYear()]);

        $this->bearer($this->user('administrator'));
        $this->getJson('/api/academic-period')->assertJsonPath('data.school_year', '2026-2027');
        $this->putJson('/api/admin/academic-period', ['semester' => '2nd', 'school_year' => '2026-2027'])
            ->assertOk()->assertJsonPath('data.semester', '2nd');
        $this->assertSame('2nd', $current->fresh()->semester);
        $this->assertSame('1st', $past->fresh()->semester);
        $this->assertTrue($future->fresh()->starts_on->isSameDay(today()->addYear()));

        $this->putJson('/api/admin/academic-period', ['semester' => '1st', 'school_year' => '2025-2026'])
            ->assertUnprocessable()->assertJsonValidationErrors('school_year');
    }

    public function test_invalid_periods_are_rejected_without_changing_the_current_period(): void
    {
        $this->bearer($this->user('administrator'));
        foreach ([
            [],
            ['semester' => 'summer', 'school_year' => '2026-2027'],
            ['semester' => '1st', 'school_year' => '2026/2027'],
            ['semester' => '1st', 'school_year' => '2026-2028'],
            ['semester' => ['1st'], 'school_year' => '2026-2027'],
            ['semester' => '1st', 'school_year' => ['2026-2027']],
        ] as $payload) {
            $this->putJson('/api/admin/academic-period', $payload)->assertUnprocessable();
        }

        $this->assertDatabaseCount('academic_terms', 0);
    }
}
