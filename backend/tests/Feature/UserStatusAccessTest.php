<?php

namespace Tests\Feature;

use App\Enums\UserStatus;
use App\Models\OtpCode;
use App\Models\TrustedDevice;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\SecurityTestCase;

class UserStatusAccessTest extends SecurityTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config(['app.frontend_url' => 'http://localhost:5173']);
        config(['institution.student_domain' => 'student.edu.ph']);
        config(['institution.staff_domain' => 'staff.edu.ph']);
    }

    private function makeUser(?string $status, string $role = 'student', array $extra = []): User
    {
        return User::factory()->create(array_merge([
            'role' => $role,
            'status' => $status,
        ], $extra));
    }

    public function test_enum_is_an_allowlist_that_fails_closed(): void
    {
        $this->assertTrue(UserStatus::allowsLogin('approved'));
        $this->assertTrue(UserStatus::allowsLogin('pending'));
        $this->assertFalse(UserStatus::allowsLogin('deactivated'));
        $this->assertFalse(UserStatus::allowsLogin(null));
        $this->assertFalse(UserStatus::allowsLogin('suspended'));
        $this->assertFalse(UserStatus::allowsLogin(''));
    }

    public function test_deactivated_user_with_valid_token_is_rejected_and_token_revoked(): void
    {
        $user = $this->makeUser('deactivated');
        $token = $user->createToken('alrm-spa')->plainTextToken;

        $this->withToken($token)->getJson('/api/me')->assertForbidden();

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_database_rejects_null_status(): void
    {
        $this->expectException(QueryException::class);

        DB::table('users')->insert([
            'id' => (string) Str::uuid(),
            'name' => 'Null Status',
            'email' => 'null.status@example.com',
            'status' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_pending_user_can_still_reach_me(): void
    {
        $user = $this->makeUser('pending');
        $token = $user->createToken('alrm-spa')->plainTextToken;

        $this->withToken($token)->getJson('/api/me')->assertOk();
    }

    public function test_pending_student_is_reported_as_pending_without_revoking_the_token(): void
    {
        $user = $this->makeUser('pending');
        $token = $user->createToken('alrm-spa')->plainTextToken;

        $this->withToken($token)->getJson('/api/classes')
            ->assertForbidden()
            ->assertJsonPath('message', 'Your account is pending approval. Please contact an administrator.');

        $this->assertSame('pending', $user->fresh()->status);
        $this->assertSame(1, $user->tokens()->count());
    }

    public function test_can_login_fails_closed_for_null_status_in_memory(): void
    {
        $user = new User;
        $user->status = null;

        $this->assertFalse($user->canLogin());
    }

    public function test_otp_verify_is_blocked_for_deactivated_user(): void
    {
        $user = $this->makeUser('deactivated');

        OtpCode::create([
            'user_id' => $user->id,
            'code' => '123456',
            'expires_at' => now()->addMinutes(5),
        ]);

        $pending = Str::random(40);
        Cache::put('auth_pending:'.$pending, $user->id, 600);
        $this->postJson('/api/auth/otp/verify', [
            'pending' => $pending,
            'user_id' => $user->id,
            'code' => '123456',
        ])->assertForbidden();

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_otp_resend_is_blocked_for_deactivated_user(): void
    {
        $user = $this->makeUser('deactivated');

        $pending = Str::random(40);
        Cache::put('auth_pending:'.$pending, $user->id, 600);
        $this->postJson('/api/auth/otp/resend', ['user_id' => $user->id, 'pending' => $pending])
            ->assertForbidden();

        $this->assertSame(0, OtpCode::where('user_id', $user->id)->count());
    }

    public function test_exchange_refuses_code_for_user_deactivated_after_login(): void
    {
        $user = $this->makeUser('deactivated');
        $token = $user->createToken('alrm-spa')->plainTextToken;
        $code = Str::random(40);
        Cache::put('auth_exchange:'.$code, $token, 60);

        $this->postJson('/api/auth/exchange', ['code' => $code])
            ->assertForbidden();

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_admin_deactivation_revokes_tokens_and_trusted_devices(): void
    {
        $admin = $this->makeUser('approved', 'administrator');
        $target = $this->makeUser('approved', 'instructor', ['google_id' => 'g-target']);

        $target->createToken('alrm-spa');
        TrustedDevice::create([
            'user_id' => $target->id,
            'token_hash' => Hash::make('secret'),
            'user_agent' => 'phpunit',
            'ip_address' => '127.0.0.1',
            'last_used_at' => now(),
            'expires_at' => now()->addDay(),
        ]);

        $adminToken = $admin->createToken('alrm-spa')->plainTextToken;

        $this->withToken($adminToken)
            ->patchJson("/api/admin/users/{$target->id}/status", ['status' => 'deactivated'])
            ->assertOk();

        $target->refresh();
        $this->assertSame('deactivated', $target->status);
        $this->assertSame(0, $target->tokens()->count());
        $this->assertSame(0, TrustedDevice::where('user_id', $target->id)->count());
    }

    public function test_admin_endpoint_still_accepts_legacy_inactive_value(): void
    {
        $admin = $this->makeUser('approved', 'administrator');
        $target = $this->makeUser('approved', 'instructor', ['google_id' => 'g-legacy']);

        $adminToken = $admin->createToken('alrm-spa')->plainTextToken;

        $this->withToken($adminToken)
            ->patchJson("/api/admin/users/{$target->id}/status", ['status' => 'inactive'])
            ->assertOk();

        $this->assertSame('deactivated', $target->refresh()->status);
    }

    public function test_admin_can_assign_an_external_pending_accounts_role_before_approval(): void
    {
        $admin = $this->makeUser('approved', 'administrator');
        $external = $this->makeUser('pending', 'student', [
            'email' => 'visitor@gmail.com', 'google_id' => 'external-google-id',
        ]);

        $this->bearer($external)->getJson('/api/instructor/dashboard')->assertForbidden();
        $this->bearer($external)
            ->patchJson("/api/admin/users/{$external->id}/status", ['status' => 'approved'])
            ->assertForbidden();

        $this->bearer($admin)
            ->patchJson("/api/admin/users/{$external->id}/role", ['role' => 'instructor'])
            ->assertOk();
        $this->assertSame('pending', $external->refresh()->status);
        $this->assertSame('instructor', $external->role);
        $this->bearer($external)->getJson('/api/instructor/dashboard')->assertForbidden();

        $this->bearer($admin)
            ->patchJson("/api/admin/users/{$external->id}/status", ['status' => 'approved'])
            ->assertOk();
        $this->assertSame('approved', $external->fresh()->status);
        $this->bearer($external)->getJson('/api/instructor/requests')->assertOk();
    }

    public function test_external_pending_accounts_appear_in_the_admin_review_list(): void
    {
        $admin = $this->makeUser('approved', 'administrator');
        $external = $this->makeUser('pending', 'student', [
            'email' => 'visitor@gmail.com', 'google_id' => 'external-google-id',
        ]);

        $this->bearer($admin)->getJson('/api/admin/users?status=pending')
            ->assertOk()->assertJsonFragment(['id' => $external->id]);
    }
}
