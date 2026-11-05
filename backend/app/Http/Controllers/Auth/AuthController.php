<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Support\ExternalApiClient;
use App\Support\SingleUseCode;
use App\Support\TrustedDeviceManager;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;
use Laravel\Socialite\Two\User as SocialiteUser;

class AuthController extends Controller
{
    private const DEFAULT_STAFF_ROLE = 'instructor';

    /**
     * Allowed frontend origins (exact scheme+host match, not prefix match).
     */
    private function allowedOrigins(): array
    {
        return array_values(array_filter([
            rtrim((string) config('app.frontend_url', 'http://localhost:5173'), '/'),
            rtrim((string) config('app.frontend_url_prod'), '/'),
        ]));
    }

    /**
     * Exact-match origin check (scheme + host + port), not str_starts_with.
     */
    private function resolveOrigin(?string $origin): ?string
    {
        if (! $origin) {
            return null;
        }

        $parsed = parse_url($origin);
        if (! $parsed || empty($parsed['host'])) {
            return null;
        }

        $normalized = ($parsed['scheme'] ?? 'https').'://'.$parsed['host']
            .(isset($parsed['port']) ? ':'.$parsed['port'] : '');

        foreach ($this->allowedOrigins() as $allowed) {
            if (rtrim($allowed, '/') === $normalized) {
                return $normalized;
            }
        }

        return null;
    }

    /**
     * Google callback URL on the given (already allowlisted) frontend origin.
     * The /api rewrite/proxy forwards it to this backend.
     */
    private function callbackUrlFor(string $frontendUrl): string
    {
        return rtrim($frontendUrl, '/').'/api/auth/google/callback';
    }

    /**
     * Mint a Sanctum token and wrap it in a one-time exchange code (60s).
     */
    private function makeExchangeCode(User $user): string
    {
        $token = $user->createToken('alrm-spa', ['*'], now()->addHours(8))->plainTextToken;
        $code = Str::random(40);
        Cache::put("auth_exchange:{$code}", $token, now()->addSeconds(60));

        return $code;
    }

    /**
     * Step 1 — Send the user's browser to Google's consent screen.
     *
     * GET /api/auth/google/redirect
     */
    public function redirect(Request $request): RedirectResponse
    {
        $request->validate(['origin' => ['sometimes', 'string', 'max:2048']]);
        $origin = $request->query('origin')
            ?? $request->headers->get('referer');

        $frontendUrl = $this->resolveOrigin($origin)
            ?? ($this->allowedOrigins()[0] ?? null);

        if (! $frontendUrl) {
            abort(500, 'No valid frontend URL configured.');
        }

        $nonce = Str::random(64);
        Cache::put('oauth_state:'.hash('sha256', $nonce), true, now()->addMinutes(10));
        $state = Crypt::encryptString(json_encode([
            'origin' => $frontendUrl,
            'nonce' => $nonce,
            'exp' => now()->addMinutes(10)->timestamp,
        ]));

        /** @var GoogleProvider $driver */
        $driver = Socialite::driver('google');

        return $driver
            ->stateless()
            ->redirectUrl($this->callbackUrlFor($frontendUrl))
            ->with(['state' => $state])
            ->redirect()
            ->cookie('alrm_oauth', $nonce, 10, '/api/auth/google', null,
                app()->environment('production'), true, false, 'lax');
    }

    /**
     * Step 2 — Google redirects here with an auth code.
     *
     * GET /api/auth/google/callback
     *
     * When GOOGLE_REDIRECT_URI points at the frontend domain (via the /api
     * proxy), the browser sends the alrm_device cookie here, so we can decide
     * "trusted or OTP" right now and skip the extra check-trusted round trip.
     */
    public function callback(Request $request): RedirectResponse
    {
        $frontendUrl = $this->decodeState($request);

        if (! $frontendUrl) {
            $defaultFrontend = $this->allowedOrigins()[0] ?? null;
            abort_unless($defaultFrontend, 500, 'No valid frontend URL configured.');

            return redirect()->away($defaultFrontend.'/login?error=oauth_failed')
                ->withoutCookie('alrm_oauth', '/api/auth/google');
        }

        return $this->completeCallback($request, $frontendUrl)
            ->withoutCookie('alrm_oauth', '/api/auth/google');
    }

    private function completeCallback(Request $request, string $frontendUrl): RedirectResponse
    {
        try {
            /** @var GoogleProvider $driver */
            $driver = Socialite::driver('google');
            $driver->setHttpClient(ExternalApiClient::make());

            /** @var SocialiteUser $googleUser */
            $googleUser = $driver
                ->stateless()
                ->redirectUrl($this->callbackUrlFor($frontendUrl))
                ->user();
        } catch (\Throwable $e) {
            Log::warning('Google OAuth callback failed', ['exception' => get_class($e)]);

            return redirect()->away(
                $frontendUrl.'/login?error=oauth_failed'
            );
        }

        $email = strtolower((string) $googleUser->getEmail());
        $googleId = (string) $googleUser->getId();
        $raw = $googleUser->getRaw();
        if (! filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255
            || $googleId === '' || strlen($googleId) > 255
            || ($raw['email_verified'] ?? $raw['verified_email'] ?? false) !== true) {
            return redirect()->away($frontendUrl.'/login?error=oauth_failed');
        }
        $domain = substr(strrchr($email, '@') ?: '', 1);

        $studentDomain = strtolower((string) config('institution.student_domain'));
        $staffDomain = strtolower((string) config('institution.staff_domain'));

        $isStudent = $domain === $studentDomain;
        $isStaff = $domain === $staffDomain;
        $isInstitutional = $isStudent || $isStaff;

        $user = User::query()->firstOrNew(['email' => $email]);

        $isNewUser = ! $user->exists;

        if (! $isNewUser && ! $user->canLogin()) {
            return redirect()->away(
                $frontendUrl.'/login?error=account_disabled'
            );
        }

        if ($user->google_id !== null && ! hash_equals((string) $user->google_id, $googleId)) {
            return redirect()->away($frontendUrl.'/login?error=oauth_failed');
        }

        $user->google_id = $googleId;

        if ($isNewUser) {
            $user->name = mb_substr($googleUser->getName() ?: $email, 0, 255);
            // External accounts start with the least-privileged role and cannot
            // access role routes until an administrator reviews their account.
            $user->role = $isStaff ? self::DEFAULT_STAFF_ROLE : 'student';
            $user->status = $isInstitutional ? 'approved' : 'pending';
            $user->password = null;
        } elseif ($user->status === 'pending' && $isInstitutional) {
            $user->name = mb_substr($googleUser->getName() ?: $email, 0, 255);
            $user->status = 'approved';
            $user->password = null;
        }
        $user->save();

        if ($user->canLogin() && TrustedDeviceManager::isTrusted($request, $user)) {
            $code = $this->makeExchangeCode($user);

            return redirect()->away(
                $frontendUrl.'/auth/otp?exchange_code='.urlencode($code)
            );
        }

        $pending = Str::random(40);
        Cache::put("auth_pending:{$pending}", $user->id, now()->addMinutes(10));

        if (Cache::add("auth_pending_sent:{$pending}", true, now()->addMinutes(10))) {
            OtpController::issue($user);
        }

        return redirect()->away(
            $frontendUrl.'/auth/otp?user_id='.urlencode($user->id)
                .'&pending='.urlencode($pending)
                .'&checked=1'
        );
    }

    /**
     * Require an unexpired, browser-bound state and consume its nonce once.
     */
    private function decodeState(Request $request): ?string
    {
        $state = $request->query('state');
        if (! is_string($state) || $state === '' || strlen($state) > 4096) {
            return null;
        }

        try {
            $payload = json_decode(Crypt::decryptString($state), true);
        } catch (DecryptException) {
            Log::warning('OAuth state failed decryption — possible tampering.');

            return null;
        }

        if (! is_array($payload) || ! is_string($payload['origin'] ?? null)
            || ! is_int($payload['exp'] ?? null) || ! is_string($payload['nonce'] ?? null)) {
            return null;
        }

        if (now()->timestamp >= $payload['exp']) {
            Log::warning('OAuth state expired.');

            return null;
        }

        $cookie = $request->cookie('alrm_oauth');
        if (! is_string($cookie) || strlen($cookie) !== 64
            || ! hash_equals($payload['nonce'], $cookie)) {
            return null;
        }

        foreach ($this->allowedOrigins() as $allowed) {
            if (rtrim($allowed, '/') === rtrim($payload['origin'], '/')) {
                return SingleUseCode::consume('oauth_state:'.hash('sha256', $cookie))
                    ? rtrim($payload['origin'], '/') : null;
            }
        }

        return null;
    }

    /**
     * POST /api/auth/otp/check-trusted
     *
     * Fallback for when the callback was reached without the alrm_device
     * cookie (e.g. GOOGLE_REDIRECT_URI still pointing at onrender.com).
     * The "pending" token proves the user just finished Google sign-in.
     */
    public function checkTrusted(Request $request): JsonResponse
    {
        $request->validate(['pending' => 'required|string|size:40']);

        return DB::transaction(fn () => $this->checkTrustedLocked($request));
    }

    private function checkTrustedLocked(Request $request): JsonResponse
    {

        $pending = (string) $request->input('pending');
        $userId = Cache::get("auth_pending:{$pending}");
        $user = $userId ? User::whereKey($userId)->lockForUpdate()->first() : null;

        if ($user && Cache::get("auth_pending:{$pending}") !== $user->id) {
            $user = null;
        }

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Your login session expired. Please sign in again.',
                'data' => null,
            ], 410);
        }

        if (! $user->canLogin()) {
            return response()->json([
                'success' => false,
                'message' => 'Your account is not active. Please contact an administrator.',
                'data' => null,
            ], 403);
        }

        if (TrustedDeviceManager::isTrusted($request, $user)) {
            Cache::forget("auth_pending:{$pending}");

            return response()->json([
                'success' => true,
                'message' => 'Trusted device.',
                'data' => [
                    'trusted' => true,
                    'exchange_code' => $this->makeExchangeCode($user),
                ],
            ]);
        }

        if (Cache::add("auth_pending_sent:{$pending}", true, now()->addMinutes(10))) {
            OtpController::issue($user);
        }

        return response()->json([
            'success' => true,
            'message' => 'OTP required.',
            'data' => ['trusted' => false],
        ]);
    }

    /**
     * Step 3 — SPA exchanges the one-time code for the real Sanctum token.
     *
     * POST /api/auth/exchange
     */
    public function exchange(Request $request): JsonResponse
    {
        $request->validate([
            'code' => 'required|string|size:40',
        ]);

        $token = SingleUseCode::consume("auth_exchange:{$request->string('code')}");

        if (! $token) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired code.',
                'data' => null,
            ], 401);
        }

        $accessToken = PersonalAccessToken::findToken($token);
        $user = $accessToken?->tokenable;

        if (! $user || ! $user->canLogin()) {
            $accessToken?->delete();

            return response()->json([
                'success' => false,
                'message' => 'Your account is not active. Please contact an administrator.',
                'data' => null,
            ], 403);
        }

        return response()->json([
            'success' => true,
            'message' => 'OK',
            'data' => [
                'token' => $token,
                'user' => UserResource::forExchange($user->load('program', 'programs')),
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out.',
            'data' => null,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'OK',
            'data' => new UserResource($request->user()->load('program', 'programs')),
        ]);
    }
}
