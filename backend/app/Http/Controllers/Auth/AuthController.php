<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Auth\OtpController;
use App\Support\TrustedDeviceManager;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;

class AuthController extends Controller
{
    /**
     * Domains allowed to sign in, mapped to the role they resolve to.
     *
     * Student domain auto-resolves to 'student'.
     * Staff domain auto-resolves to 'instructor' — this is a FALLBACK
     * default, not a final answer. Some staff are actually Program Heads
     * or Administrators, but there's no way to tell that from the email
     * domain alone. Those cases are handled after the fact: an Admin
     * changes the user's role via PATCH /api/admin/users/{user}/role
     * once it's known the account needs something other than the
     * instructor default. See UserApprovalController::updateRole().
     */
    private const STUDENT_DOMAIN = 'student.laverdad.edu.ph';

    private const STAFF_DOMAIN = 'laverdad.edu.ph';

    /**
     * Default role assigned to a brand-new staff-domain account on first
     * login. Deliberately the most common/least-privileged staff role —
     * Admin promotes from here, never demotes from something over-assigned.
     */
    private const DEFAULT_STAFF_ROLE = 'instructor';

    /**
     * Step 1 — Send the user's browser to Google's consent screen.
     *
     * GET /api/auth/google/redirect
     */
    public function redirect(): RedirectResponse
    {
        return Socialite::driver('google')
            ->stateless()
            ->redirect();
    }

    /**
     * Step 2 — Google redirects the browser back here with an auth code.
     * We exchange it for the user's Google profile, validate the domain,
     * find-or-create the local user, issue a Sanctum token, then redirect
     * the browser back to the React frontend with the token attached.
     *
     * This is a full browser redirect (not an AJAX call), so we cannot
     * return JSON here — nothing on the frontend would be able to read it.
     * Instead we bounce back to the SPA with ?token=... in the query string;
     * the frontend grabs it, stores it, then calls GET /api/me to hydrate
     * the rest of the session.
     *
     * GET /api/auth/google/callback
     */
    public function callback(): RedirectResponse
    {
        Log::debug('Raw code received', [
            'code' => request()->query('code'),
            'length' => strlen((string) request()->query('code')),
        ]);

        $frontendUrl = rtrim((string) config('app.frontend_url', env('FRONTEND_URL')), '/');

        try {
            $googleUser = Socialite::driver('google')
                ->stateless()
                ->user();
        } catch (InvalidStateException | \Throwable $e) {
            Log::warning('Google OAuth callback failed', ['error' => $e->getMessage()]);

            return redirect()->away(
                $frontendUrl . '/login?error=oauth_failed'
            );
        }

        $email = strtolower((string) $googleUser->getEmail());
        $domain = substr(strrchr($email, '@') ?: '', 1);

        if (! in_array($domain, [self::STUDENT_DOMAIN, self::STAFF_DOMAIN], true)) {
            return redirect()->away(
                $frontendUrl . '/login?error=invalid_domain'
            );
        }

        $isStudent = $domain === self::STUDENT_DOMAIN;

        $user = User::query()->firstOrNew(['email' => $email]);

        $isNewUser = ! $user->exists;

        $user->google_id = $googleUser->getId();
        $user->name = $googleUser->getName() ?: $user->name;

        if ($isNewUser) {
            $user->role = $isStudent ? 'student' : self::DEFAULT_STAFF_ROLE;
            $user->status = 'approved';
            $user->password = null;
        }
        $user->save();

        // NEW: check kung trusted na itong browser/device
        if (TrustedDeviceManager::isTrusted(request(), $user)) {
            // Skip OTP — derecho na sa exchange code
            $token = $user->createToken('alrm-spa')->plainTextToken;
            $code = Str::random(40);
            Cache::put("auth_exchange:{$code}", $token, now()->addSeconds(60));

            return redirect()->away(
                $frontendUrl . '/auth/callback?code=' . urlencode($code)
            );
        }

        OtpController::issue($user);

        return redirect()->away(
            $frontendUrl . '/auth/otp?user_id=' . urlencode($user->id)
        );
    }

    /**
     * Step 3 — SPA exchanges the one-time code (from the callback redirect)
     * for the actual Sanctum token. The code is single-use and expires
     * after 60 seconds, so a token never sits exposed in the URL/history.
     *
     * POST /api/auth/exchange
     */
    public function exchange(Request $request): JsonResponse
    {
        $request->validate([
            'code' => 'required|string',
        ]);

        $token = Cache::pull("auth_exchange:{$request->string('code')}");

        if (! $token) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired code.',
                'data'    => null,
            ], 401);
        }

        return response()->json([
            'success' => true,
            'message' => 'OK',
            'data'    => ['token' => $token],
        ]);
    }

    /**
     * Revoke the token used to authenticate the current request.
     *
     * POST /api/logout
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out.',
            'data'    => null,
        ]);
    }

    /**
     * Return the authenticated user's profile.
     * Frontend calls this right after grabbing ?token= from the callback
     * redirect, to hydrate role/status/program without decoding the token.
     *
     * GET /api/me
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'OK',
            'data'    => $request->user(),
        ]);
    }
}
