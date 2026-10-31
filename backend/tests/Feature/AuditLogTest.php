<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\FollowupFlag;
use App\Services\AuditLoggerService;
use Tests\SecurityTestCase;

class AuditLogTest extends SecurityTestCase
{
    public function test_submission_followup_and_decision_are_visible_to_admin_and_own_program_head(): void
    {
        $student = $this->user();
        $instructor = $this->user('instructor');
        $head = $this->user('program_head');
        $fixture = $this->requestFor($student, $instructor);
        $fixture->enrollment->class->program->update(['program_head_id' => $head->id]);

        $response = $this->bearer($student)->postJson('/api/requests', [
            'class_id' => $fixture->enrollment->class_id,
            'type' => 'absence', 'subjects_missed' => 'Security',
            'reason' => 'Medical appointment', 'start_date_of_absence' => '2026-10-23',
            'evidence_file_url' => $this->unusedEvidence($student)->id,
            'guardian_name' => 'Parent Name', 'contact_number' => '09123456789',
        ])->assertCreated();
        $id = $response->json('data.id');
        $this->bearer($student)->postJson("/api/requests/{$id}/follow-up")->assertCreated();
        $this->bearer($instructor)->patchJson("/api/instructor/requests/{$id}/decision", ['status' => 'approved'])->assertOk();

        foreach ([$this->user('administrator'), $head] as $viewer) {
            $prefix = $viewer->role === 'administrator' ? 'admin' : 'program-head';
            $result = $this->bearer($viewer)->getJson("/api/{$prefix}/audit-logs?request_id={$id}&page=1")
                ->assertOk()->assertJsonPath('meta.total', 3);
            $this->assertEqualsCanonicalizing([
                'submitted_request', 'followed_up_request', 'decided_request_approved',
            ], array_column($result->json('data'), 'action'));
            foreach ($result->json('data') as $entry) {
                $this->assertSame($id, $entry['request']['id']);
                $this->assertSame($student->id, $entry['request']['student']['id']);
                $this->assertNotNull($entry['timestamp']);
                $this->assertArrayNotHasKey('reason', $entry['request']);
            }
        }
        $this->bearer($head)->getJson('/api/program-head/audit-logs?role=instructor&action=decided_request_approved')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.actor.id', $instructor->id);
    }

    public function test_program_head_cannot_read_other_programs_even_for_shared_instructors(): void
    {
        $instructor = $this->user('instructor');
        $head = $this->user('program_head');
        $own = $this->requestFor($this->user(), $instructor);
        $own->enrollment->class->program->update(['program_head_id' => $head->id]);
        $other = $this->requestFor($this->user(), $instructor);
        $this->actingAs($instructor);
        foreach ([$own, $other] as $request) {
            app(AuditLoggerService::class)->log('decided_request_noted', 'requests', $request->id);
            $flag = FollowupFlag::create([
                'request_id' => $request->id, 'flagged_date' => now(),
                'escalated_to' => $instructor->id, 'status' => 'resolved',
            ]);
            app(AuditLoggerService::class)->log('resolved_followup_flag', 'followup_flags', $flag->id);
        }
        $this->bearer($head)->getJson('/api/program-head/audit-logs?page=1')
            ->assertOk()->assertJsonPath('meta.total', 2);
        $this->bearer($head)->getJson('/api/program-head/audit-logs?request_id='.$other->id)
            ->assertOk()->assertJsonCount(0, 'data');
        $this->bearer($this->user('administrator'))->getJson('/api/admin/audit-logs?page=1')
            ->assertOk()->assertJsonPath('meta.total', 4);
    }

    public function test_access_is_read_only_and_restricted_to_admin_and_assigned_program_head(): void
    {
        $this->getJson('/api/admin/audit-logs')->assertUnauthorized();
        foreach (['student', 'instructor'] as $role) {
            $this->bearer($this->user($role))->getJson('/api/admin/audit-logs')->assertForbidden();
            $this->getJson('/api/program-head/audit-logs')->assertForbidden();
        }
        $this->bearer($this->user('program_head'))->getJson('/api/program-head/audit-logs')->assertForbidden();
        $this->bearer($this->user('administrator'))->postJson('/api/admin/audit-logs', [])->assertStatus(405);
    }

    public function test_request_edits_and_cancellation_are_logged_but_failed_actions_are_not(): void
    {
        $student = $this->user();
        $request = $this->requestFor($student);
        $this->bearer($this->user())->deleteJson('/api/requests/'.$request->id)->assertForbidden();
        $this->assertSame(0, AuditLog::count());
        $this->bearer($student)->patchJson('/api/requests/'.$request->id, [
            'type' => 'absence', 'subjects_missed' => 'Security',
            'reason' => 'Updated reason', 'start_date_of_absence' => '2026-10-21',
        ])->assertOk();
        $this->deleteJson('/api/requests/'.$request->id)->assertOk();
        $this->assertDatabaseHas('audit_log', ['user_id' => $student->id, 'action' => 'updated_request', 'record_id' => $request->id]);
        $this->assertDatabaseHas('audit_log', ['user_id' => $student->id, 'action' => 'cancelled_request', 'record_id' => $request->id]);
    }

    public function test_filters_are_validated_and_timestamp_filter_uses_recorded_time(): void
    {
        $student = $this->user();
        $request = $this->requestFor($student);
        $this->actingAs($student);
        $this->travelTo(now()->startOfDay()->subDays(2));
        app(AuditLoggerService::class)->log('submitted_request', 'requests', $request->id);
        $this->travelBack();
        $this->bearer($this->user('administrator'));
        $this->getJson('/api/admin/audit-logs?from='.now()->toDateString())->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/admin/audit-logs?to='.now()->toDateString())->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/audit-logs?role=administrator')->assertUnprocessable();
        $this->getJson('/api/admin/audit-logs?per_page=101')->assertUnprocessable();
        $this->getJson('/api/admin/audit-logs?from=2026-10-24&to=2026-10-01')->assertUnprocessable();
    }
}
