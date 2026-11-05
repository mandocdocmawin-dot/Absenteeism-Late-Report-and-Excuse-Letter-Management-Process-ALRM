<?php

namespace Tests\Feature;

use App\Mail\InstructorExcuseRequestMail;
use App\Mail\InstructorFollowUpMail;
use App\Mail\StudentRequestUpdatedMail;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Mail\MailManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\SecurityTestCase;

class RequestMailDeliveryTest extends SecurityTestCase
{
    protected function user(string $role = 'student', array $attributes = []): User
    {
        $user = parent::user($role, ['google_id' => 'google-linked', ...$attributes]);
        $user->forceFill(['email_notifications_enabled' => true])->save();

        return $user;
    }

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'mail.instructor_notify_allowlist' => [],
            'mail.instructor_test_recipient' => null,
            'mail.student_test_recipient' => null,
            'mail.test_recipient' => null,
        ]);
    }

    public function test_submission_creates_one_in_app_alert_and_queues_instructor_email(): void
    {
        $request = $this->requestFor($this->user());
        $submission = $request->replicate();
        $submission->save();

        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $request->enrollment->class->instructor_id,
            'type' => 'new_request', 'channel' => 'in_app',
        ]);
        Mail::assertQueued(InstructorExcuseRequestMail::class, fn ($mail) => $mail->hasTo($request->enrollment->class->instructor->email) && $mail->tries === 3 && $mail->afterCommit
        );
    }

    public function test_decision_queues_one_student_email_and_one_in_app_alert(): void
    {
        $student = $this->user();
        $request = $this->requestFor($student);
        config(['mail.student_test_recipient' => 'student-tester@example.com']);

        $endpoint = '/api/instructor/requests/'.$request->id.'/decision';
        $this->bearer($request->enrollment->class->instructor)->patchJson($endpoint, ['status' => 'approved'])->assertOk();
        $this->bearer($request->enrollment->class->instructor)->patchJson($endpoint, ['status' => 'approved'])->assertConflict();

        Mail::assertQueued(StudentRequestUpdatedMail::class, 1);
        Mail::assertQueued(StudentRequestUpdatedMail::class, fn ($mail) => $mail->hasTo('student-tester@example.com') && ! $mail->hasTo($student->email)
            && $mail->tries === 3 && $mail->afterCommit
        );
        $this->assertDatabaseCount('notifications', 1);
        $this->bearer($student)->getJson('/api/notifications')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.type', 'request_decision');
    }

    public function test_followup_queues_once_with_the_same_case_insensitive_recipient_rules(): void
    {
        $student = $this->user();
        $request = $this->requestFor($student);
        $instructor = $request->enrollment->class->instructor;
        config([
            'mail.instructor_notify_allowlist' => [strtoupper($instructor->email)],
            'mail.instructor_test_recipient' => 'instructor-tester@example.com',
        ]);
        $endpoint = '/api/requests/'.$request->id.'/follow-up';
        $this->bearer($student)->postJson($endpoint)->assertCreated();
        $this->bearer($student)->postJson($endpoint)->assertStatus(429);

        Mail::assertQueued(InstructorFollowUpMail::class, 1);
        Mail::assertQueued(InstructorFollowUpMail::class, fn ($mail) => $mail->hasTo('instructor-tester@example.com') && $mail->followupCount === 1
            && $mail->tries === 3 && $mail->afterCommit
            && str_ends_with($mail->reviewUrl, '/instructor/class-requests')
        );
        $this->assertDatabaseHas('notifications', [
            'user_id' => $instructor->id, 'type' => 'request_followup', 'channel' => 'in_app',
        ]);
        $this->assertDatabaseCount('notifications', 1);
    }

    public function test_allowlist_blocks_both_instructor_mails_without_suppressing_in_app_alerts(): void
    {
        $student = $this->user();
        $request = $this->requestFor($student);
        config(['mail.instructor_notify_allowlist' => ['different@example.com']]);
        $submission = $request->replicate();
        $submission->save();
        $this->bearer($student)->postJson('/api/requests/'.$request->id.'/follow-up')->assertCreated();

        Mail::assertNotQueued(InstructorExcuseRequestMail::class);
        Mail::assertNotQueued(InstructorFollowUpMail::class);
        $this->assertDatabaseCount('notifications', 2);
    }

    public function test_inactive_students_and_cancelled_requests_do_not_get_decision_emails(): void
    {
        $request = $this->requestFor($this->user('student', ['status' => 'deactivated']));
        $request->update(['status' => 'approved']);
        Mail::assertNotQueued(StudentRequestUpdatedMail::class);

        $cancelled = $this->requestFor($this->user());
        $cancelled->update(['status' => 'cancelled']);
        Mail::assertNotQueued(StudentRequestUpdatedMail::class);
    }

    public function test_queue_jobs_and_alerts_are_discarded_on_rollback_and_queued_after_commit(): void
    {
        config(['queue.default' => 'database', 'mail.default' => 'array']);
        Mail::swap(new MailManager($this->app));
        $request = $this->requestFor($this->user());

        DB::beginTransaction();
        $submission = $request->replicate();
        $submission->save();
        $this->assertDatabaseCount('jobs', 0);
        DB::rollBack();
        $this->assertDatabaseCount('jobs', 0);
        $this->assertDatabaseCount('notifications', 0);

        DB::beginTransaction();
        $submission = $request->replicate();
        $submission->save();
        $this->assertDatabaseCount('jobs', 0);
        DB::commit();
        $this->assertDatabaseCount('jobs', 1);
        $this->assertDatabaseCount('notifications', 1);

        DB::beginTransaction();
        $submission->update(['status' => 'approved']);
        $this->assertDatabaseCount('jobs', 1);
        DB::rollBack();
        $this->assertDatabaseCount('jobs', 1);
        $this->assertSame('pending', $submission->fresh()->status);

        DB::beginTransaction();
        $submission = $submission->fresh();
        $submission->update(['status' => 'approved']);
        $this->assertDatabaseCount('jobs', 1);
        DB::commit();
        $this->assertDatabaseCount('jobs', 2);
    }

    public function test_notification_lists_counts_and_read_actions_exclude_historical_email_records(): void
    {
        $student = $this->user();
        $appAlert = UserNotification::create([
            'user_id' => $student->id, 'type' => 'request_decision', 'channel' => 'in_app',
            'message' => 'Your request was approved.', 'date_sent' => now(), 'is_read' => false,
        ]);
        $emailRecord = UserNotification::create([
            'user_id' => $student->id, 'type' => 'request_updated', 'channel' => 'email',
            'message' => 'Email record.', 'date_sent' => now(), 'is_read' => false,
        ]);
        $this->bearer($student)->getJson('/api/notifications?page=1&per_page=10')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 1);
        $this->bearer($student)->getJson('/api/notifications?unread=1')->assertOk()->assertJsonCount(1, 'data');
        $this->bearer($student)->getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('data.unread_count', 1);
        $this->bearer($student)->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('data.unread_notifications', 1)->assertJsonCount(1, 'data.recent_notifications');
        $this->bearer($student)->patchJson('/api/notifications/'.$emailRecord->id.'/read')->assertForbidden();
        $this->bearer($student)->patchJson('/api/notifications/read-all')->assertOk();
        $this->assertTrue($appAlert->fresh()->is_read);
        $this->assertFalse($emailRecord->fresh()->is_read);
        $this->bearer($student)->getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('data.unread_count', 0);
    }
}
