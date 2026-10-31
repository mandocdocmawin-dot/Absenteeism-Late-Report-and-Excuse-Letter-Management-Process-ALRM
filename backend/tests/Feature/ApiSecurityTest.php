<?php

namespace Tests\Feature;

use App\Exports\ReportExport;
use App\Models\AttendanceTracker;
use App\Models\ExcuseRequest;
use App\Models\FollowupFlag;
use App\Models\OtpCode;
use App\Models\UserNotification;
use App\Support\ExternalApiClient;
use App\Support\SingleUseCode;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use Tests\SecurityTestCase;

class ApiSecurityTest extends SecurityTestCase
{
    public function test_idle_token_is_rejected_even_after_cache_loss(): void
    {
        $user = $this->user();
        $token = $user->createToken('idle');
        $token->accessToken->forceFill([
            'created_at' => now()->subHour(), 'last_used_at' => now()->subMinutes(16),
        ])->save();
        Cache::flush();
        $this->withToken($token->plainTextToken)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_new_unused_token_expires_after_idle_limit(): void
    {
        $token = $this->user()->createToken('unused');
        $token->accessToken->forceFill(['created_at' => now()->subMinutes(16)])->save();
        $this->withToken($token->plainTextToken)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_active_token_still_has_an_absolute_eight_hour_expiry(): void
    {
        $token = $this->user()->createToken('old');
        $token->accessToken->forceFill([
            'created_at' => now()->subHours(9), 'last_used_at' => now(),
        ])->save();
        $this->withToken($token->plainTextToken)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_active_token_works_and_private_auth_response_is_not_cached(): void
    {
        $user = $this->user('student', ['google_id' => 'private-google-id',
            'guardian_name' => 'Guardian', 'contact_number' => '09123456789']);
        $response = $this->bearer($user)->getJson('/api/me')->assertOk()
            ->assertJsonPath('data.guardian_name', 'Guardian')
            ->assertJsonMissingPath('data.google_id')
            ->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
    }

    public function test_deactivated_token_is_revoked(): void
    {
        $user = $this->user('student', ['status' => 'deactivated']);
        $this->bearer($user)->getJson('/api/me')->assertForbidden();
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_students_cannot_call_staff_functions(): void
    {
        $user = $this->user();
        foreach (['/api/admin/users', '/api/admin/reports/export', '/api/instructor/requests',
            '/api/program-head/requests'] as $path) {
            $this->bearer($user)->getJson($path)->assertForbidden();
        }
    }

    public function test_requests_evidence_and_notifications_are_owner_scoped(): void
    {
        $owner = $this->user();
        $other = $this->user();
        $request = $this->requestFor($owner);
        foreach (["/api/requests/{$request->id}", "/api/requests/{$request->id}/evidence"] as $path) {
            $this->bearer($other)->getJson($path)->assertForbidden();
        }
        $this->bearer($other)->deleteJson('/api/requests/'.$request->id)->assertForbidden();
        $notification = UserNotification::create([
            'user_id' => $owner->id, 'message' => 'Private', 'type' => 'test',
            'channel' => 'in_app', 'date_sent' => now(), 'is_read' => false,
        ]);
        $this->bearer($other)->patchJson('/api/notifications/'.$notification->id.'/read')->assertForbidden();
        $this->assertFalse($notification->fresh()->is_read);
    }

    public function test_other_instructor_cannot_decide_and_repeated_decision_counts_once(): void
    {
        $instructor = $this->user('instructor');
        $request = $this->requestFor($this->user(), $instructor);
        $url = '/api/instructor/requests/'.$request->id.'/decision';
        $this->bearer($this->user('instructor'))->patchJson($url, ['status' => 'invalid'])->assertForbidden();
        $this->bearer($instructor)->patchJson($url, ['status' => 'invalid'])->assertOk();
        $this->bearer($instructor)->patchJson($url, ['status' => 'invalid'])->assertConflict();
        $this->assertSame(1, AttendanceTracker::firstOrFail()->total_absences);
        $this->assertSame(1, UserNotification::where('type', 'request_decision')->count());
    }

    public function test_followup_cooldown_and_owner_checks(): void
    {
        $owner = $this->user();
        $request = $this->requestFor($owner);
        $url = '/api/requests/'.$request->id.'/follow-up';
        $this->bearer($this->user())->postJson($url)->assertForbidden();
        $this->bearer($owner)->postJson($url)->assertCreated();
        $this->bearer($owner)->postJson($url)->assertStatus(429);
        $this->assertSame(1, FollowupFlag::count());
    }

    public function test_cancel_preserves_record_and_blocks_later_edits(): void
    {
        $owner = $this->user();
        $request = $this->requestFor($owner);
        $this->bearer($owner)->deleteJson('/api/requests/'.$request->id)
            ->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertSame(1, ExcuseRequest::count());
        $this->bearer($owner)->patchJson('/api/requests/'.$request->id, [])->assertForbidden();
    }

    public function test_duplicate_submissions_are_rejected(): void
    {
        $owner = $this->user();
        $existing = $this->requestFor($owner);
        $payload = ['class_id' => $existing->enrollment->class_id, 'type' => 'late',
            'subjects_missed' => 'Security', 'minutes_late' => 10, 'reason' => 'Bus delay',
            'start_date_of_absence' => '2026-10-21',
            'evidence_file_url' => $this->unusedEvidence($owner)->id,
            'guardian_name' => 'Guardian', 'contact_number' => '09123456789'];
        $this->bearer($owner)->postJson('/api/requests', $payload)->assertCreated();
        $this->bearer($owner)->postJson('/api/requests', array_replace($payload, [
            'evidence_file_url' => $this->unusedEvidence($owner)->id,
        ]))->assertConflict();
        $this->assertSame(2, ExcuseRequest::count());
    }

    public function test_submission_limit_is_per_user_and_rejects_excess_requests(): void
    {
        $owner = $this->user();
        for ($i = 0; $i < 5; $i++) {
            $this->bearer($owner)->postJson('/api/requests', [])->assertUnprocessable();
        }
        $this->bearer($owner)->postJson('/api/requests', [])->assertStatus(429);
        $this->bearer($this->user())->postJson('/api/requests', [])->assertUnprocessable();
    }

    public function test_exchange_is_single_use_and_does_not_expose_internal_user_fields(): void
    {
        $user = $this->user('student', ['guardian_name' => 'Guardian']);
        $token = $user->createToken('exchange')->plainTextToken;
        $code = Str::random(40);
        Cache::put('auth_exchange:'.$code, $token, 60);
        $this->postJson('/api/auth/exchange', ['code' => $code])->assertOk()
            ->assertJsonMissingPath('data.user.google_id')->assertJsonPath('data.user.guardian_name', 'Guardian');
        $this->postJson('/api/auth/exchange', ['code' => $code])->assertUnauthorized();
    }

    public function test_single_use_code_fails_closed_while_another_consumer_holds_lock(): void
    {
        $key = 'auth_exchange:'.Str::random(40);
        Cache::put($key, 'secret', 60);
        $lock = Cache::lock('consume:'.hash('sha256', $key), 10);
        $this->assertTrue($lock->get());
        $this->assertNull(SingleUseCode::consume($key));
        $lock->release();
        $this->assertSame('secret', SingleUseCode::consume($key));
        $this->assertNull(SingleUseCode::consume($key));
    }

    public function test_otp_cannot_be_replayed_and_attempt_budget_is_not_reset_by_resend(): void
    {
        $user = $this->user();
        $pending = Str::random(40);
        Cache::put('auth_pending:'.$pending, $user->id, 600);
        $otp = OtpCode::create(['user_id' => $user->id, 'code' => '123456',
            'attempts' => 0, 'expires_at' => now()->addMinutes(5)]);
        $payload = ['user_id' => $user->id, 'pending' => $pending, 'code' => '000000'];
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/otp/verify', $payload)->assertUnprocessable();
        }
        $this->postJson('/api/auth/otp/resend', $payload)->assertStatus(429);
        $this->assertSame(5, $otp->fresh()->attempts);
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_successful_otp_is_consumed_once(): void
    {
        $user = $this->user();
        $pending = Str::random(40);
        Cache::put('auth_pending:'.$pending, $user->id, 600);
        OtpCode::create(['user_id' => $user->id, 'code' => '123456',
            'expires_at' => now()->addMinutes(5)]);
        $payload = ['user_id' => $user->id, 'pending' => $pending, 'code' => '123456'];
        $this->postJson('/api/auth/otp/verify', $payload)->assertOk();
        $this->postJson('/api/auth/otp/verify', $payload)->assertStatus(410);
        $this->assertSame(1, $user->tokens()->count());
        $this->assertNotNull($user->tokens()->first()->expires_at);
    }

    public function test_lists_preserve_arrays_and_support_bounded_pages(): void
    {
        $user = $this->user();
        for ($i = 0; $i < 3; $i++) {
            UserNotification::create(['user_id' => $user->id, 'type' => 'test', 'message' => 'Message',
                'channel' => 'in_app', 'date_sent' => now()]);
        }
        $this->bearer($user)->getJson('/api/notifications')->assertOk()->assertJsonCount(3, 'data');
        $this->bearer($user)->getJson('/api/notifications?page=2&per_page=2')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 3);
        $this->bearer($user)->getJson('/api/notifications?per_page=100000')->assertUnprocessable();
    }

    public function test_related_users_do_not_disclose_private_identity_or_guardian_fields(): void
    {
        $instructor = $this->user('instructor');
        $this->requestFor($this->user('student', ['google_id' => 'secret', 'guardian_name' => 'Private']), $instructor);
        $this->bearer($instructor)->getJson('/api/instructor/requests')->assertOk()
            ->assertJsonMissingPath('data.0.enrollment.student.google_id')
            ->assertJsonMissingPath('data.0.enrollment.student.guardian_name');
    }

    public function test_program_head_cannot_view_another_programs_requests_or_evidence(): void
    {
        $head = $this->user('program_head');
        $own = $this->requestFor($this->user());
        $own->enrollment->class->program->update(['program_head_id' => $head->id]);
        $other = $this->requestFor($this->user());
        $this->bearer($head)->getJson('/api/program-head/requests')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $own->id);
        $this->bearer($head)->getJson('/api/requests/'.$other->id.'/evidence')->assertForbidden();
    }

    public function test_all_registered_api_actions_exist_and_debug_database_routes_are_absent(): void
    {
        foreach ($this->app['router']->getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/')) {
                continue;
            }
            [$class, $method] = explode('@', $route->getActionName());
            $this->assertTrue(method_exists($class, $method), $route->uri());
            $this->assertStringNotContainsString('DbTest', $class);
        }
        $this->getJson('/api/test/programs')->assertNotFound();
    }

    public function test_login_rate_limit_and_malformed_otp_input(): void
    {
        $this->postJson('/api/auth/otp/verify', ['pending' => ['unexpected']])->assertUnprocessable();
        for ($i = 0; $i < 19; $i++) {
            $this->get('/api/auth/google/callback')->assertRedirect();
        }
        $this->getJson('/api/auth/google/callback')->assertStatus(429);
    }

    public function test_profile_and_request_inputs_cannot_change_privileged_fields(): void
    {
        $owner = $this->user();
        $request = $this->requestFor($owner);
        $this->bearer($owner)->patchJson('/api/requests/'.$request->id, [
            'type' => 'late', 'subjects_missed' => 'Security', 'minutes_late' => 10,
            'reason' => 'Updated reason', 'status' => 'approved', 'reviewed_by' => $owner->id,
            'start_date_of_absence' => '2026-10-21',
        ])->assertOk()->assertJsonPath('data.status', 'pending');
        $this->assertNull($request->fresh()->reviewed_by);
        $this->bearer($owner)->postJson('/api/complete-profile', [
            'role' => 'administrator', 'status' => 'approved',
        ])->assertUnprocessable();
        $this->assertSame('student', $owner->fresh()->role);
    }

    public function test_foreign_evidence_identifier_cannot_be_assigned_during_edit(): void
    {
        $owner = $this->user();
        $request = $this->requestFor($owner);
        $this->bearer($owner)->patchJson('/api/requests/'.$request->id, [
            'type' => 'late', 'subjects_missed' => 'Security', 'minutes_late' => 10,
            'reason' => 'Updated reason', 'evidence_file_url' => (string) Str::uuid(),
            'start_date_of_absence' => '2026-10-21',
        ])->assertUnprocessable();
        $this->assertNull($request->fresh()->evidence_file_url);
    }

    public function test_legacy_list_never_silently_truncates_large_results(): void
    {
        $user = $this->user();
        $rows = [];
        for ($i = 0; $i < 501; $i++) {
            $rows[] = ['id' => (string) Str::uuid(), 'user_id' => $user->id,
                'type' => 'test', 'message' => 'Private', 'channel' => 'in_app', 'date_sent' => now()];
        }
        UserNotification::insert($rows);
        $this->bearer($user)->getJson('/api/notifications')->assertUnprocessable();
        $this->bearer($user)->getJson('/api/notifications?page=1&per_page=100')->assertOk()
            ->assertJsonCount(100, 'data')->assertJsonPath('meta.total', 501);
    }

    public function test_admin_user_collection_uses_explicit_response_fields(): void
    {
        $admin = $this->user('administrator');
        $this->user('student', ['google_id' => 'secret']);
        $response = $this->bearer($admin)->getJson('/api/admin/users')->assertOk()->assertJsonCount(2, 'data');
        foreach ($response->json('data') as $user) {
            $this->assertArrayNotHasKey('google_id', $user);
            $this->assertArrayNotHasKey('password', $user);
        }
    }

    public function test_exported_user_text_is_literal_rather_than_a_spreadsheet_formula(): void
    {
        $spreadsheet = new Spreadsheet;
        $cell = $spreadsheet->getActiveSheet()->getCell('A1');
        (new ReportExport(collect()))->bindValue($cell, '=1+1');
        $this->assertSame(DataType::TYPE_STRING, $cell->getDataType());
        $this->assertSame('=1+1', $cell->getValue());
    }

    public function test_google_http_transport_has_tls_timeouts_and_no_redirects(): void
    {
        $client = ExternalApiClient::make();
        $this->assertTrue($client->getConfig('verify'));
        $this->assertSame(5, $client->getConfig('connect_timeout'));
        $this->assertSame(15, $client->getConfig('timeout'));
        $this->assertFalse($client->getConfig('allow_redirects'));
    }

    public function test_production_readiness_command_rejects_unsafe_configuration(): void
    {
        config(['app.env' => 'production', 'app.debug' => true]);
        $this->artisan('security:check')->expectsOutput('FAIL: Debug mode disabled')->assertFailed();
    }

    public function test_production_readiness_command_accepts_shared_cache_and_https(): void
    {
        config(['app.env' => 'production', 'app.debug' => false, 'cache.default' => 'database',
            'app.frontend_url' => 'https://frontend.example.test']);
        $this->artisan('security:check')->assertSuccessful();
    }
}
