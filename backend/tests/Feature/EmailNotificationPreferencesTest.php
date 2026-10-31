<?php

namespace Tests\Feature;

use App\Mail\InstructorExcuseRequestMail;
use App\Mail\InstructorFollowUpMail;
use App\Mail\ProgramHeadAttendanceAlertMail;
use App\Mail\StudentRequestUpdatedMail;
use App\Models\AttendanceTracker;
use App\Services\AttendanceThresholdNotifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\SecurityTestCase;

class EmailNotificationPreferencesTest extends SecurityTestCase
{
    public function test_preference_defaults_to_off_in_database_and_me_response(): void
    {
        $user = $this->user('student', ['google_id' => 'linked']);
        $this->assertFalse($user->email_notifications_enabled);
        $this->assertFalse($user->fresh()->email_notifications_enabled);
        $this->assertSame(0, (int) DB::table('users')->where('id', $user->id)->value('email_notifications_enabled'));
        $this->bearer($user)->getJson('/api/me')->assertOk()
            ->assertJsonPath('data.email_notifications_enabled', false);
    }

    public function test_user_can_enable_and_disable_only_their_own_email_preference(): void
    {
        $user = $this->user('student', ['google_id' => 'linked']);
        $other = $this->user();
        foreach ([true, false] as $enabled) {
            $this->bearer($user)->patchJson('/api/me/notification-preferences', [
                'email_notifications_enabled' => $enabled,
                'user_id' => $other->id, 'role' => 'administrator', 'google_id' => 'replacement',
                'request_activity_updates' => false, 'attendance_threshold_alerts' => false,
            ])->assertOk()->assertJsonPath('data.email_notifications_enabled', $enabled);
            $this->assertSame($enabled, $user->fresh()->email_notifications_enabled);
            $this->bearer($user)->getJson('/api/me')->assertOk()
                ->assertJsonPath('data.email_notifications_enabled', $enabled);
            $this->assertFalse($other->fresh()->email_notifications_enabled);
            $this->assertSame('student', $user->fresh()->role);
            $this->assertSame('linked', $user->fresh()->google_id);
        }
    }

    public function test_endpoint_requires_authentication_active_account_and_valid_boolean(): void
    {
        $endpoint = '/api/me/notification-preferences';
        $this->patchJson($endpoint, ['email_notifications_enabled' => true])->assertUnauthorized();
        $user = $this->user();
        foreach ([[], ['email_notifications_enabled' => null], ['email_notifications_enabled' => 'yes']] as $payload) {
            $this->bearer($user)->patchJson($endpoint, $payload)->assertUnprocessable()
                ->assertJsonValidationErrors('email_notifications_enabled');
        }
        $this->bearer($this->user('student', ['status' => 'deactivated']))
            ->patchJson($endpoint, ['email_notifications_enabled' => true])->assertForbidden();
    }

    public function test_request_and_followup_emails_require_google_id_and_opt_in_even_with_test_redirect(): void
    {
        config(['mail.instructor_test_recipient' => 'tester@example.com', 'mail.instructor_notify_allowlist' => []]);
        $student = $this->user();
        foreach ([[null, true], ['', true], ['linked', false], ['linked', true]] as [$googleId, $enabled]) {
            Mail::fake();
            $instructor = $this->user('instructor', ['google_id' => $googleId]);
            $instructor->forceFill(['email_notifications_enabled' => $enabled])->save();
            $request = $this->requestFor($student, $instructor);
            $submission = $request->replicate();
            $submission->save();
            $this->bearer($student)->postJson('/api/requests/'.$request->id.'/follow-up')->assertCreated();
            if ($googleId === 'linked' && $enabled) {
                Mail::assertQueued(InstructorExcuseRequestMail::class, 1);
                Mail::assertQueued(InstructorFollowUpMail::class, 1);
            } else {
                Mail::assertNothingQueued();
            }
            $this->assertDatabaseHas('notifications', ['user_id' => $instructor->id, 'type' => 'new_request', 'channel' => 'in_app']);
            $this->assertDatabaseHas('notifications', ['user_id' => $instructor->id, 'type' => 'request_followup', 'channel' => 'in_app']);
        }
    }

    public function test_decision_emails_require_google_id_and_opt_in(): void
    {
        foreach ([[null, true], ['linked', false], ['linked', true]] as [$googleId, $enabled]) {
            Mail::fake();
            $student = $this->user('student', ['google_id' => $googleId]);
            $student->forceFill(['email_notifications_enabled' => $enabled])->save();
            $request = $this->requestFor($student);
            $this->bearer($request->enrollment->class->instructor)
                ->patchJson('/api/instructor/requests/'.$request->id.'/decision', ['status' => 'approved'])
                ->assertOk();
            Mail::assertQueued(StudentRequestUpdatedMail::class, $googleId !== null && $enabled ? 1 : 0);
            $this->assertDatabaseHas('notifications', ['user_id' => $student->id, 'type' => 'request_decision', 'channel' => 'in_app']);
        }
    }

    public function test_attendance_emails_respect_email_preference_and_google_link_without_suppressing_in_app_alerts(): void
    {
        config(['mail.program_head_test_recipient' => 'tester@example.com']);
        foreach ([[null, true], ['linked', false], ['linked', true]] as [$googleId, $enabled]) {
            Mail::fake();
            $request = $this->requestFor($this->user());
            $head = $this->user('program_head', [
                'program_id' => $request->enrollment->class->program_id, 'google_id' => $googleId,
            ]);
            $head->forceFill(['email_notifications_enabled' => $enabled])->save();
            $tracker = AttendanceTracker::create([
                'enrollment_id' => $request->enrollment_id, 'total_absences' => 3,
                'total_lates' => 0, 'converted_absences' => 3, 'status' => 'warning',
            ]);
            app(AttendanceThresholdNotifier::class)->notify($tracker);
            Mail::assertQueued(ProgramHeadAttendanceAlertMail::class, $googleId !== null && $enabled ? 1 : 0);
            $this->assertDatabaseHas('notifications', ['user_id' => $head->id, 'type' => 'threshold_warning', 'channel' => 'in_app']);
        }
    }
}
