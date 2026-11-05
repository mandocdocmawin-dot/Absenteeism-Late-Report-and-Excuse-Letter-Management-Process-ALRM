<?php

namespace Tests\Feature;

use App\Models\OtpCode;
use App\Models\Program;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery;
use Tests\SecurityTestCase;

class AuthControllerOAuthTest extends SecurityTestCase
{
    private function state(string $nonce, array $overrides = []): string
    {
        Cache::put('oauth_state:'.hash('sha256', $nonce), true, 600);

        return Crypt::encryptString(json_encode([
            'origin' => 'http://localhost:5173', 'nonce' => $nonce,
            'exp' => now()->addMinutes(10)->timestamp, ...$overrides,
        ]));
    }

    private function provider(array $overrides = [], string $email = 'student1@student.edu.ph'): void
    {
        $googleUser = (new SocialiteUser)->setRaw(['email_verified' => true, ...$overrides])->map([
            'id' => 'google-123', 'email' => $email, 'name' => 'Student',
        ]);
        $provider = Mockery::mock(GoogleProvider::class);
        $provider->shouldReceive('setHttpClient')->once()->andReturnSelf();
        $provider->shouldReceive('stateless')->once()->andReturnSelf();
        $provider->shouldReceive('redirectUrl')->once()->with('http://localhost:5173/api/auth/google/callback')->andReturnSelf();
        $provider->shouldReceive('user')->once()->andReturn($googleUser);
        Socialite::shouldReceive('driver')->once()->with('google')->andReturn($provider);
    }

    public function test_missing_tampered_expired_and_wrong_origin_states_do_not_call_google(): void
    {
        Socialite::shouldReceive('driver')->never();
        $nonce = Str::random(64);
        foreach ([null, 'tampered', $this->state($nonce, ['exp' => now()->subSecond()->timestamp]),
            $this->state($nonce, ['origin' => 'https://evil.example'])] as $state) {
            $this->withUnencryptedCookies(['alrm_oauth' => $nonce])
                ->get('/api/auth/google/callback?'.http_build_query(['state' => $state]))
                ->assertRedirect('http://localhost:5173/login?error=oauth_failed');
        }
        $this->assertSame(0, User::count());
    }

    public function test_valid_signed_state_without_matching_browser_cookie_is_rejected(): void
    {
        Socialite::shouldReceive('driver')->never();
        $state = $this->state(Str::random(64));
        $this->get('/api/auth/google/callback?state='.urlencode($state))
            ->assertRedirect('http://localhost:5173/login?error=oauth_failed');
        $this->withUnencryptedCookies(['alrm_oauth' => Str::random(64)])
            ->get('/api/auth/google/callback?state='.urlencode($state))
            ->assertRedirect('http://localhost:5173/login?error=oauth_failed');
    }

    public function test_browser_bound_state_completes_login_once_and_issues_only_pending_otp(): void
    {
        $this->provider();
        $nonce = Str::random(64);
        $state = $this->state($nonce);
        $this->withUnencryptedCookies(['alrm_oauth' => $nonce])
            ->get('/api/auth/google/callback?state='.urlencode($state))
            ->assertRedirectContains('/auth/otp?user_id=');
        $this->assertSame(1, User::count());
        $this->assertSame(0, User::first()->tokens()->count());
        $this->withUnencryptedCookies(['alrm_oauth' => $nonce])
            ->get('/api/auth/google/callback?state='.urlencode($state))
            ->assertRedirect('http://localhost:5173/login?error=oauth_failed');
    }

    public function test_unverified_google_email_is_rejected(): void
    {
        $this->provider(['email_verified' => false]);
        $nonce = Str::random(64);
        $this->withUnencryptedCookies(['alrm_oauth' => $nonce])
            ->get('/api/auth/google/callback?state='.urlencode($this->state($nonce)))
            ->assertRedirect('http://localhost:5173/login?error=oauth_failed');
        $this->assertSame(0, User::count());
    }

    public function test_google_subject_cannot_replace_an_existing_account_identity(): void
    {
        $user = $this->user('student', ['email' => 'student1@student.edu.ph', 'google_id' => 'different-subject']);
        $this->provider();
        $nonce = Str::random(64);
        $this->withUnencryptedCookies(['alrm_oauth' => $nonce])
            ->get('/api/auth/google/callback?state='.urlencode($this->state($nonce)))
            ->assertRedirect('http://localhost:5173/login?error=oauth_failed');
        $this->assertSame('different-subject', $user->fresh()->google_id);
    }

    public function test_returning_pending_student_is_auto_approved_after_verified_google_sign_in(): void
    {
        $user = $this->user('student', [
            'email' => 'student1@student.edu.ph', 'google_id' => 'google-123', 'status' => 'pending',
        ]);
        $this->provider();
        $nonce = Str::random(64);

        $this->withUnencryptedCookies(['alrm_oauth' => $nonce])
            ->get('/api/auth/google/callback?state='.urlencode($this->state($nonce)))
            ->assertRedirectContains('/auth/otp?user_id=');

        $this->assertSame('approved', $user->fresh()->status);
        $this->assertSame('student', $user->role);
        $this->assertSame(0, $user->tokens()->count()); // OTP is still required.
        $this->assertSame(1, OtpCode::where('user_id', $user->id)->count());
    }

    public function test_returning_pending_allowlisted_student_instructor_is_auto_approved(): void
    {
        config(['institution.student_domain' => 'student.laverdad.edu.ph']);
        $email = User::STUDENT_INSTRUCTOR_EMAILS[0];
        $user = $this->user('instructor', [
            'email' => $email, 'google_id' => 'google-123', 'status' => 'pending',
        ]);
        $this->provider([], $email);
        $nonce = Str::random(64);

        $this->withUnencryptedCookies(['alrm_oauth' => $nonce])
            ->get('/api/auth/google/callback?state='.urlencode($this->state($nonce)))
            ->assertRedirectContains('/auth/otp?user_id=');

        $this->assertSame('approved', $user->fresh()->status);
        $this->assertSame('instructor', $user->role);
    }

    public function test_new_staff_is_auto_approved_but_still_requires_otp(): void
    {
        $this->provider([], 'faculty@staff.edu.ph');
        $nonce = Str::random(64);
        $this->withUnencryptedCookies(['alrm_oauth' => $nonce])
            ->get('/api/auth/google/callback?state='.urlencode($this->state($nonce)))
            ->assertRedirectContains('/auth/otp?user_id=');

        $user = User::where('email', 'faculty@staff.edu.ph')->firstOrFail();
        $this->assertSame('approved', $user->status);
        $this->assertSame('instructor', $user->role);
        $this->assertSame(0, $user->tokens()->count());
        $this->assertSame(1, OtpCode::where('user_id', $user->id)->count());
    }

    public function test_external_google_account_starts_pending_with_no_dashboard_access(): void
    {
        $this->provider([], 'visitor@gmail.com');
        $nonce = Str::random(64);
        $this->withUnencryptedCookies(['alrm_oauth' => $nonce])
            ->get('/api/auth/google/callback?state='.urlencode($this->state($nonce)))
            ->assertRedirectContains('/auth/otp?user_id=');

        $user = User::where('email', 'visitor@gmail.com')->firstOrFail();
        $this->assertSame('pending', $user->status);
        $this->assertSame('student', $user->role);
        $this->assertSame(0, $user->tokens()->count());
        $this->bearer($user)->getJson('/api/dashboard')->assertForbidden();
        $this->bearer($user)->getJson('/api/instructor/dashboard')->assertForbidden();
        $this->bearer($user)->getJson('/api/admin/dashboard')->assertForbidden();
    }

    public function test_pre_registered_staff_keeps_the_assigned_role_and_is_auto_approved(): void
    {
        $user = $this->user('program_head', [
            'email' => 'head@staff.edu.ph', 'google_id' => null, 'status' => 'pending',
        ]);
        $this->provider([], $user->email);
        $nonce = Str::random(64);
        $this->withUnencryptedCookies(['alrm_oauth' => $nonce])
            ->get('/api/auth/google/callback?state='.urlencode($this->state($nonce)))
            ->assertRedirectContains('/auth/otp?user_id=');

        $this->assertSame('approved', $user->fresh()->status);
        $this->assertSame('program_head', $user->role);
    }

    public function test_admin_approved_external_account_stays_approved_on_next_login(): void
    {
        $user = $this->user('instructor', [
            'email' => 'visitor@gmail.com', 'google_id' => 'google-123',
        ]);
        $this->provider([], $user->email);
        $nonce = Str::random(64);
        $this->withUnencryptedCookies(['alrm_oauth' => $nonce])
            ->get('/api/auth/google/callback?state='.urlencode($this->state($nonce)))
            ->assertRedirectContains('/auth/otp?user_id=');

        $this->assertSame('approved', $user->fresh()->status);
        $this->assertSame('instructor', $user->role);
    }

    public function test_first_google_login_keeps_roster_assignments_and_uses_google_name(): void
    {
        foreach (['student', 'instructor', 'program_head', 'administrator'] as $role) {
            $program = Program::factory()->create();
            $domain = $role === 'student' ? 'student.edu.ph' : 'staff.edu.ph';
            $user = $this->user($role, [
                'email' => $role.'@'.$domain, 'name' => 'Roster Name',
                'status' => 'pending', 'google_id' => null,
                'school_id_number' => 'ID-'.$role,
                'program_id' => $role === 'student' ? $program->id : null,
                'year_level' => $role === 'student' ? '2nd' : null,
            ]);
            if ($role === 'instructor') {
                $user->programs()->attach($program);
            } elseif ($role === 'program_head') {
                $program->update(['program_head_id' => $user->id]);
            }

            $this->provider([], $user->email);
            $nonce = Str::random(64);
            $this->withUnencryptedCookies(['alrm_oauth' => $nonce])
                ->get('/api/auth/google/callback?state='.urlencode($this->state($nonce)))
                ->assertRedirectContains('/auth/otp?user_id=');

            $user->refresh();
            $this->assertSame('Student', $user->name);
            $this->assertSame('google-123', $user->google_id);
            $this->assertSame('approved', $user->status);
            $this->assertSame($role, $user->role);
            $this->assertSame('ID-'.$role, $user->school_id_number);
            $this->assertSame($role === 'student' ? $program->id : null, $user->program_id);
            $this->assertSame($role === 'student' ? '2nd' : null, $user->year_level);
            $this->assertSame($role === 'instructor' ? 1 : 0, $user->programs()->count());
            $this->assertSame($role === 'program_head' ? $user->id : null, $program->fresh()->program_head_id);
        }
    }

    public function test_returning_external_account_is_not_automatically_approved(): void
    {
        $user = $this->user('instructor', [
            'email' => 'visitor@student.edu.ph.evil.example', 'google_id' => 'google-123', 'status' => 'pending',
        ]);
        $this->provider([], $user->email);
        $nonce = Str::random(64);
        $this->withUnencryptedCookies(['alrm_oauth' => $nonce])
            ->get('/api/auth/google/callback?state='.urlencode($this->state($nonce)))
            ->assertRedirectContains('/auth/otp?user_id=');

        $this->assertSame('pending', $user->fresh()->status);
        $this->assertSame('instructor', $user->role);
    }

    public function test_pre_registered_external_account_does_not_skip_admin_approval(): void
    {
        $user = $this->user('program_head', [
            'email' => 'visitor@gmail.com', 'google_id' => null, 'status' => 'pending',
        ]);
        $this->provider([], $user->email);
        $nonce = Str::random(64);
        $this->withUnencryptedCookies(['alrm_oauth' => $nonce])
            ->get('/api/auth/google/callback?state='.urlencode($this->state($nonce)))
            ->assertRedirectContains('/auth/otp?user_id=');

        $this->assertSame('pending', $user->fresh()->status);
        $this->assertSame('program_head', $user->role);
    }

    public function test_disabled_account_does_not_receive_otp_or_token(): void
    {
        $user = $this->user('student', [
            'email' => 'student1@student.edu.ph', 'google_id' => 'google-123', 'status' => 'deactivated',
        ]);
        $this->provider();
        $nonce = Str::random(64);
        $this->withUnencryptedCookies(['alrm_oauth' => $nonce])
            ->get('/api/auth/google/callback?state='.urlencode($this->state($nonce)))
            ->assertRedirectContains('error=account_disabled');
        $this->assertSame(0, $user->tokens()->count());
        $this->assertSame(0, OtpCode::count());
    }

    public function test_redirect_issues_http_only_state_cookie_and_caches_nonce(): void
    {
        $captured = [];
        $provider = Mockery::mock(GoogleProvider::class);
        $provider->shouldReceive('stateless')->once()->andReturnSelf();
        $provider->shouldReceive('redirectUrl')->once()->andReturnSelf();
        $provider->shouldReceive('with')->once()->andReturnUsing(function ($parameters) use (&$captured, $provider) {
            $captured = json_decode(Crypt::decryptString($parameters['state']), true);

            return $provider;
        });
        $provider->shouldReceive('redirect')->once()->andReturn(redirect('https://accounts.google.com/'));
        Socialite::shouldReceive('driver')->once()->andReturn($provider);
        $response = $this->get('/api/auth/google/redirect');
        $this->assertIsArray($captured);
        $this->assertArrayHasKey('nonce', $captured);
        $cookie = collect($response->headers->getCookies())->firstWhere(fn ($cookie) => $cookie->getName() === 'alrm_oauth');
        $this->assertNotNull($cookie);
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertSame('lax', $cookie->getSameSite());
        $this->assertSame($captured['nonce'], $cookie->getValue());
        $this->assertTrue(Cache::has('oauth_state:'.hash('sha256', $cookie->getValue())));
    }
}
