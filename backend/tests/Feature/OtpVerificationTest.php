<?php

namespace Tests\Feature;

use App\Http\Controllers\Auth\OtpController;
use App\Models\OtpCode;
use App\Models\User;
use App\Notifications\SendOtpCode;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\SecurityTestCase;

class OtpVerificationTest extends SecurityTestCase
{
    private function pending(User $user, string $code = '004217'): array
    {
        $pending = Str::random(40);
        Cache::put('auth_pending:'.$pending, $user->id, 600);

        return ['user_id' => $user->id, 'pending' => $pending, 'code' => $code];
    }

    private function otp(User $user, array $attributes = []): OtpCode
    {
        $otp = OtpCode::create([
            'user_id' => $user->id,
            'code' => '004217',
            'expires_at' => now()->addMinutes(5),
        ]);

        $otp->forceFill($attributes)->save();

        return $otp;
    }

    public function test_issuance_stores_only_a_hash_and_notifies_with_the_matching_plaintext(): void
    {
        $user = $this->user();
        OtpController::issue($user);
        $otp = OtpCode::where('user_id', $user->id)->sole();
        $stored = DB::table('otp_codes')->where('id', $otp->id)->value('code');

        $this->assertArrayNotHasKey('code', $otp->toArray());
        Notification::assertSentTo($user, SendOtpCode::class, function ($notification) use ($user, $otp, $stored) {
            $mail = $notification->toMail($user);
            $code = $mail->viewData['code'];
            $this->assertMatchesRegularExpression('/^[0-9]{6}$/', $code);
            $this->assertNotSame($code, $stored);
            $this->assertTrue(Hash::check($code, $stored));
            $this->assertTrue($otp->expires_at->equalTo($notification->retryUntil()));

            return true;
        });
    }

    public function test_leading_zero_code_verifies_once_and_consumes_the_pending_session(): void
    {
        $user = $this->user();
        $otp = $this->otp($user);
        $payload = $this->pending($user);

        $this->assertTrue(Hash::check('004217', $otp->fresh()->code));
        $this->postJson('/api/auth/otp/verify', $payload)->assertOk();
        $this->assertNotNull($otp->fresh()->verified_at);
        $this->assertNull(Cache::get('auth_pending:'.$payload['pending']));
        $this->postJson('/api/auth/otp/verify', $payload)->assertStatus(410);
        $this->postJson('/api/auth/otp/verify', $this->pending($user))->assertNotFound();
        $this->assertSame(1, $user->tokens()->count());
    }

    public function test_wrong_code_counts_an_attempt_without_verifying_or_issuing_a_token(): void
    {
        $user = $this->user();
        $otp = $this->otp($user);

        $this->postJson('/api/auth/otp/verify', $this->pending($user, '004218'))
            ->assertUnprocessable()->assertJsonPath('message', 'Invalid code.');
        $this->assertSame(1, $otp->fresh()->attempts);
        $this->assertNull($otp->fresh()->verified_at);
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_expired_code_is_rejected_including_at_the_exact_expiry_boundary(): void
    {
        $this->freezeTime();
        $user = $this->user();
        $otp = $this->otp($user, ['expires_at' => now()]);
        $payload = $this->pending($user);

        $this->postJson('/api/auth/otp/verify', $payload)
            ->assertUnprocessable()->assertJsonPath('message', 'This code has expired. Please log in again.');
        $this->travel(1)->seconds();
        $this->postJson('/api/auth/otp/verify', $payload)->assertUnprocessable();
        $this->assertNull($otp->fresh()->verified_at);
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_resend_invalidates_old_code_and_preserves_attempts_and_cooldown(): void
    {
        $this->freezeTime();
        $user = $this->user();
        $old = $this->otp($user, ['attempts' => 2, 'created_at' => now()->subSeconds(31)]);
        $payload = $this->pending($user);

        $this->postJson('/api/auth/otp/resend', $payload)->assertOk();
        $this->assertNull($old->fresh());
        $new = OtpCode::where('user_id', $user->id)->sole();
        $this->assertSame(2, $new->attempts);
        $this->assertFalse((new SendOtpCode('004217', otpId: $old->id))->shouldSend($user, 'mail'));

        Notification::assertSentTo($user, SendOtpCode::class, function ($notification) use ($user, $new, $payload) {
            $code = $notification->toMail($user)->viewData['code'];
            $this->assertTrue(Hash::check($code, $new->code));
            $this->assertTrue($new->expires_at->equalTo($notification->retryUntil()));
            // A newly generated code may coincidentally match the old digits.
            if ($code !== '004217') {
                $this->postJson('/api/auth/otp/verify', $payload)->assertUnprocessable();
            }
            $this->postJson('/api/auth/otp/resend', $payload)->assertStatus(429);
            $this->postJson('/api/auth/otp/verify', [...$payload, 'code' => $code])->assertOk();

            return true;
        });
    }

    public function test_five_failed_attempts_lock_out_verification_and_resend(): void
    {
        $user = $this->user();
        $otp = $this->otp($user, ['created_at' => now()->subMinute()]);
        $payload = $this->pending($user, '999999');
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/otp/verify', $payload)->assertUnprocessable();
        }

        $this->postJson('/api/auth/otp/verify', [...$payload, 'code' => '004217'])->assertStatus(429);
        $this->postJson('/api/auth/otp/resend', $payload)->assertStatus(429);
        $this->assertSame(5, $otp->fresh()->attempts);
        $this->assertSame(0, $user->tokens()->count());
        Notification::assertNothingSent();
    }

    public function test_migration_removes_legacy_plaintext_but_keeps_hashes_and_rollback_is_noop(): void
    {
        $user = $this->user();
        $hashed = $this->otp($user);
        $legacy = $this->otp($user);
        DB::table('otp_codes')->where('id', $legacy->id)->update(['code' => '004217']);
        $migration = require database_path('migrations/2026_10_29_000001_remove_legacy_plaintext_otp_codes.php');

        $migration->up();
        $this->assertNull($legacy->fresh());
        $this->assertTrue(Hash::check('004217', $hashed->fresh()->code));
        $migration->down();
        $this->assertSame(1, OtpCode::count());
    }
}
