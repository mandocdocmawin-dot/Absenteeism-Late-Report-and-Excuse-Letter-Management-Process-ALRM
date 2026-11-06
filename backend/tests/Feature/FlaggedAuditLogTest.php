<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\AttendanceTracker;
use App\Models\FollowupFlag;
use App\Services\AttendanceThresholdNotifier;
use App\Services\AuditLoggerService;
use Tests\SecurityTestCase;

class FlaggedAuditLogTest extends SecurityTestCase
{
    public function test_flagged_filter_is_accepted_without_relabeling_human_followups_or_resolutions(): void
    {
        $student = $this->user();
        $request = $this->requestFor($student);
        $flag = FollowupFlag::create([
            'request_id' => $request->id, 'flagged_date' => now(),
            'escalated_to' => $request->enrollment->class->instructor_id, 'status' => 'resolved',
        ]);
        $this->actingAs($student);
        app(AuditLoggerService::class)->log('followed_up_request', 'followup_flags', $flag->id);
        $this->actingAs($request->enrollment->class->instructor);
        app(AuditLoggerService::class)->log('resolved_followup_flag', 'followup_flags', $flag->id);
        $this->bearer($this->user('administrator'));
        $this->getJson('/api/admin/audit-logs?action=Flagged')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/admin/audit-logs?action=followed_up_request')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/audit-logs?action=resolved_followup_flag')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/audit-logs?action=Unknown')->assertUnprocessable();
    }

    public function test_threshold_flag_creates_one_system_audit_event_even_during_an_authenticated_request(): void
    {
        $request = $this->requestFor($this->user());
        $head = $this->user('program_head', ['program_id' => $request->enrollment->class->program_id]);
        $request->update(['status' => 'invalid']);
        $tracker = AttendanceTracker::create([
            'enrollment_id' => $request->enrollment_id, 'total_absences' => 2,
            'total_lates' => 0, 'converted_absences' => 2, 'status' => 'critical',
        ]);
        $this->actingAs($request->enrollment->class->instructor);
        app(AttendanceThresholdNotifier::class)->notify($tracker, $request);
        app(AttendanceThresholdNotifier::class)->notify($tracker, $request);
        $tracker->update(['status' => 'IR']);
        app(AttendanceThresholdNotifier::class)->notify($tracker, $request);

        $this->assertDatabaseCount('followup_flags', 1);
        $this->assertDatabaseCount('audit_log', 1);
        $log = AuditLog::sole();
        $this->assertSame('flagged_request', $log->action);
        $this->assertNull($log->user_id);
        $this->assertSame('followup_flags', $log->table_affected);
        $this->assertSame(FollowupFlag::sole()->id, $log->record_id);
        $this->bearer($head)->getJson('/api/program-head/audit-logs?action=Flagged')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.action', 'flagged_request')
            ->assertJsonPath('data.0.description', 'Flagged')
            ->assertJsonPath('data.0.actor', null)->assertJsonPath('data.0.request.id', $request->id);
    }

    public function test_overdue_automation_records_flagged_events_once_without_a_signed_in_actor(): void
    {
        $student = $this->user();
        $request = $this->requestFor($student);
        $program = $request->enrollment->class->program;
        $head = $this->user('program_head', ['program_id' => $program->id]);
        $program->update(['program_head_id' => $head->id]);
        $student->forceFill(['program_id' => $program->id])->save();
        $request->update(['date_submitted' => now()->subHours(config('alrm.followup_response_window_hours') + 1)]);
        $this->artisan('alrm:process-automation')->assertSuccessful();
        $this->artisan('alrm:process-automation')->assertSuccessful();
        $this->assertDatabaseCount('followup_flags', 1);
        $this->assertDatabaseCount('audit_log', 1);
        $this->assertNull(AuditLog::sole()->user_id);
        $this->bearer($this->user('administrator'))->getJson('/api/admin/audit-logs?action=Flagged')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.request.id', $request->id);
    }

    public function test_flagged_events_keep_program_request_class_and_actor_filter_boundaries(): void
    {
        $requests = [];
        foreach ([0, 1] as $index) {
            $request = $this->requestFor($this->user());
            $head = $this->user('program_head', ['program_id' => $request->enrollment->class->program_id]);
            $request->update(['status' => 'invalid']);
            $tracker = AttendanceTracker::create([
                'enrollment_id' => $request->enrollment_id, 'total_absences' => 2,
                'total_lates' => 0, 'converted_absences' => 2, 'status' => 'critical',
            ]);
            app(AttendanceThresholdNotifier::class)->notify($tracker, $request);
            $requests[] = [$request, $head];
        }
        [[$own, $head], [$other]] = $requests;
        $this->bearer($head)->getJson('/api/program-head/audit-logs?action=Flagged&page=1')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.request.id', $own->id);
        $this->getJson('/api/program-head/audit-logs?action=Flagged&request_id='.$other->id)
            ->assertOk()->assertJsonCount(0, 'data');
        $this->bearer($this->user('administrator'));
        $this->getJson('/api/admin/audit-logs?action=flagged_request')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/audit-logs?action=Flagged&class_id='.$own->enrollment->class_id)
            ->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/audit-logs?action=Flagged&role=instructor')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/admin/audit-logs?action=Flagged&user_id='.$head->id)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/admin/audit-logs?page=1')->assertOk()->assertJsonPath('meta.total', 2);
        // Nullable actors do not make unrelated system actions visible.
        AuditLog::create([
            'user_id' => null, 'action' => 'submitted_request', 'table_affected' => 'requests',
            'record_id' => $own->id, 'timestamp' => now(),
        ]);
        $this->getJson('/api/admin/audit-logs?page=1')->assertOk()->assertJsonPath('meta.total', 2);
    }
}
