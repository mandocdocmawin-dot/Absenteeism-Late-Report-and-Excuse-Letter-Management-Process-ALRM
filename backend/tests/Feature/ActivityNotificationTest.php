<?php

namespace Tests\Feature;

use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Models\FollowupFlag;
use App\Models\UserNotification;
use App\Services\AuditLoggerService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\SecurityTestCase;

class ActivityNotificationTest extends SecurityTestCase
{
    public function test_each_visible_activity_notifies_active_admins_and_own_heads_once_without_email(): void
    {
        $student = $this->user();
        $request = $this->requestFor($student);
        $program = $request->enrollment->class->program;
        $head = $this->user('program_head', ['program_id' => $program->id]);
        $program->update(['program_head_id' => $head->id]);
        $head->additionalHeadedPrograms()->attach($program);
        $coHead = $this->user('instructor');
        $coHead->additionalHeadedPrograms()->attach($program);
        $admin = $this->user('administrator');
        // Matching administrator and head assignments must still deliver once.
        $admin->additionalHeadedPrograms()->attach($program);
        $otherAdmin = $this->user('administrator');
        $outsider = $this->user('program_head');
        $inactive = $this->user('program_head', ['program_id' => $program->id, 'status' => 'deactivated']);
        $inactiveAdmin = $this->user('administrator', ['status' => 'deactivated']);
        $flag = FollowupFlag::create([
            'request_id' => $request->id, 'flagged_date' => now(),
            'escalated_to' => $request->enrollment->class->instructor_id, 'status' => 'open',
        ]);

        foreach (array_keys(AuditLogResource::ACTIONS) as $action) {
            $instructorAction = str_starts_with($action, 'decided_') || $action === 'resolved_followup_flag';
            $this->actingAs($instructorAction ? $request->enrollment->class->instructor : $student);
            $isFlag = in_array($action, ['followed_up_request', 'resolved_followup_flag'], true);
            $log = app(AuditLoggerService::class)->log(
                $action, $isFlag ? 'followup_flags' : 'requests', $isFlag ? $flag->id : $request->id,
            );
            foreach ([$admin, $otherAdmin, $head, $coHead] as $recipient) {
                $notifications = UserNotification::where('user_id', $recipient->id)->where('type', 'activity_'.$action)->get();
                $this->assertCount(1, $notifications);
                $notification = $notifications->first();
                $this->assertSame($request->id, $notification->request_id);
                $this->assertSame('in_app', $notification->channel);
                $this->assertFalse($notification->is_read);
                $this->assertTrue($log->timestamp->equalTo($notification->date_sent));
                $this->assertStringContainsString($student->name, $notification->message);
                $this->assertStringContainsString('Security', $notification->message);
                $this->assertStringContainsString('absence', $notification->message);
            }
        }
        foreach ([$student, $request->enrollment->class->instructor, $outsider, $inactive, $inactiveAdmin] as $excluded) {
            $this->assertSame(0, UserNotification::where('user_id', $excluded->id)->count());
        }
        Mail::assertNothingOutgoing();

        $first = UserNotification::where('user_id', $admin->id)->first();
        $this->bearer($admin)->patchJson('/api/notifications/'.$first->id.'/read')->assertOk();
        $this->assertTrue($first->fresh()->is_read);
        $this->assertSame(count(AuditLogResource::ACTIONS), UserNotification::where('user_id', $head->id)->where('is_read', false)->count());
        $this->bearer($head)->getJson('/api/notifications')->assertOk()
            ->assertJsonCount(count(AuditLogResource::ACTIONS), 'data');
    }

    public function test_unrelated_logs_and_failed_transactions_do_not_create_activity_notifications(): void
    {
        $student = $this->user();
        $request = $this->requestFor($student);
        $admin = $this->user('administrator');
        $this->actingAs($student);
        app(AuditLoggerService::class)->log('unrelated_action', 'requests', $request->id);
        app(AuditLoggerService::class)->log('submitted_request', 'users', $student->id);
        $this->actingAs($admin);
        app(AuditLoggerService::class)->log('submitted_request', 'requests', $request->id);
        $this->assertDatabaseCount('notifications', 0);

        $this->actingAs($student);
        DB::beginTransaction();
        app(AuditLoggerService::class)->log('submitted_request', 'requests', $request->id);
        $this->assertDatabaseCount('notifications', 1);
        DB::rollBack();
        $this->assertDatabaseCount('notifications', 0);
        $this->assertSame(0, AuditLog::where('user_id', $student->id)->where('action', 'submitted_request')->where('table_affected', 'requests')->count());
        Mail::assertNothingOutgoing();
    }

    public function test_request_endpoints_keep_existing_recipients_and_add_activity_notifications(): void
    {
        $student = $this->user();
        $fixture = $this->requestFor($student);
        $instructor = $fixture->enrollment->class->instructor;
        $head = $this->user('program_head', ['program_id' => $fixture->enrollment->class->program_id]);
        $admin = $this->user('administrator');
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
        $this->patchJson("/api/instructor/requests/{$id}/decision", ['status' => 'approved'])->assertConflict();

        foreach ([$admin, $head] as $recipient) {
            $this->assertSame(3, UserNotification::where('user_id', $recipient->id)->count());
        }
        foreach (['new_request', 'request_followup'] as $type) {
            $this->assertDatabaseHas('notifications', ['user_id' => $instructor->id, 'request_id' => $id, 'type' => $type]);
        }
        $this->assertDatabaseHas('notifications', ['user_id' => $student->id, 'request_id' => $id, 'type' => 'request_decision']);
    }
}
