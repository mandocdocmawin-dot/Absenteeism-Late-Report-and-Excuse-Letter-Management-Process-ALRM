<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;

class AuthController extends Controller
{
    /**
     * Domains allowed to sign in, mapped to the role they resolve to.
     * Student domain auto-resolves to 'student'; staff domain resolves
     * to null (role assigned later by Admin) per README §9 / ALRM.md §2.
     */
    private const STUDENT_DOMAIN = 'student.laverdad.edu.ph';

    private const STAFF_DOMAIN = 'laverdad.edu.ph';

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
        $frontendUrl = rtrim((string) config('app.frontend_url', env('FRONTEND_URL')), '/');

        try {
            $googleUser = Socialite::driver('google')
                ->stateless()
                ->user();
        } catch (InvalidStateException|\Throwable $e) {
            Log::warning('Google OAuth callback failed', ['error' => $e->getMessage()]);

            return redirect()->away(
                $frontendUrl.'/login?error=oauth_failed'
            );
        }

        $email = strtolower((string) $googleUser->getEmail());
        $domain = substr(strrchr($email, '@') ?: '', 1);

        // Reject anything outside both institutional domains, even if
        // Google auth itself succeeded — per README §9 / ALRM.md §2.
        if (! in_array($domain, [self::STUDENT_DOMAIN, self::STAFF_DOMAIN], true)) {
            return redirect()->away(
                $frontendUrl.'/login?error=invalid_domain'
            );
        }

        $isStudent = $domain === self::STUDENT_DOMAIN;

        $user = User::query()->firstOrNew(['email' => $email]);

        $isNewUser = ! $user->exists;

        $user->google_id = $googleUser->getId();
        $user->name = $googleUser->getName() ?: $user->name;

        if ($isNewUser) {
            // Student email → auto-approved, role locked in immediately.
            // Staff email → pending, Admin assigns the specific role later.
            $user->role = $isStudent ? 'student' : null;
            $user->status = $isStudent ? 'approved' : 'pending';
            $user->password = null;
        }

        $user->save();

        // Revoke old tokens for this user before issuing a new one, so a
        // re-login doesn't silently pile up valid tokens over time.
        $user->tokens()->delete();

        $token = $user->createToken('alrm-spa')->plainTextToken;

        return redirect()->away(
            $frontendUrl.'/auth/callback?token='.urlencode($token)
        );
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