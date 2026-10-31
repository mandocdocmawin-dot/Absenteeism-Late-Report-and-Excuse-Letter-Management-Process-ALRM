<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\OtpCode;
use App\Models\User;
use App\Notifications\SendOtpCode;
use App\Support\TrustedDeviceManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class OtpController extends Controller
{
    /**
     * Generate and email a fresh OTP code for the given user.
     */
    public static function issue(User $user): void
    {
        DB::transaction(function () use ($user) {
            User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            self::issueLocked($user);
        });
    }

    private static function issueLocked(User $user): void
    {
        $existing = OtpCode::where('user_id', $user->id)
            ->whereNull('verified_at')
            ->where('expires_at', '>', now())
            ->latest()
            ->first();

        if ($existing) {
            return;
        }

        OtpCode::where('user_id', $user->id)
            ->whereNull('verified_at')
            ->delete();

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $otp = OtpCode::create([
            'user_id' => $user->id,
            'code' => $code,
            'expires_at' => now()->addMinutes(5),
        ]);

        $user->notify(new SendOtpCode($code, otpId: $otp->id, expiresAt: $otp->expires_at));
    }

    /**
     * Tama ba ang "pending" token para sa user_id na ito?
     * Ang token ay ibinibigay ng Google callback (AuthController::callback)
     * at nakatago sa cache nang 10 minuto.
     */
    private function pendingMatches(Request $request): bool
    {
        $pending = (string) $request->input('pending');

        if ($pending === '') {
            return false;
        }

        return (string) Cache::get("auth_pending:{$pending}")
            === (string) $request->input('user_id');
    }

    private function expiredSession(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Your login session expired. Please sign in again.',
            'data' => null,
        ], 410);
    }

    /**
     * Deactivated/NULL/unknown status: wipe pending OTPs and refuse.
     */
    private function rejectInactive(User $user): JsonResponse
    {
        OtpCode::where('user_id', $user->id)
            ->whereNull('verified_at')
            ->delete();

        return response()->json([
            'success' => false,
            'message' => 'Your account is not active. Please contact an administrator.',
            'data' => null,
        ], 403);
    }

    /**
     * POST /api/auth/otp/resend
     */
    public function resend(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => 'required|uuid|exists:users,id',
            'pending' => 'required|string|size:40',
        ]);

        return DB::transaction(function () use ($request) {
            $user = User::whereKey($request->input('user_id'))->lockForUpdate()->firstOrFail();

            return $this->resendLocked($request, $user);
        });
    }

    private function resendLocked(Request $request, User $user): JsonResponse
    {
        if (! $this->pendingMatches($request)) {
            return $this->expiredSession();
        }

        if (! $user->canLogin()) {
            return $this->rejectInactive($user);
        }

        $recent = OtpCode::where('user_id', $user->id)
            ->whereNull('verified_at')
            ->latest()
            ->first();

        if ($recent) {
            // Locked out: don't send another email, don't hand out new guesses.
            if ($recent->expires_at->isFuture() && $recent->attempts >= 5) {
                return response()->json([
                    'success' => false,
                    'message' => 'Too many attempts. Please log in again.',
                    'data' => null,
                ], 429);
            }

            $secondsSinceLastSend = $recent->created_at->diffInSeconds(now());

            if ($secondsSinceLastSend < 30) {
                $waitTime = 30 - $secondsSinceLastSend;

                return response()->json([
                    'success' => false,
                    'message' => "Please wait {$waitTime} seconds before requesting another code.",
                    'data' => ['retry_after' => $waitTime],
                ], 429);
            }
        }

        // Carry over failed attempts of a still-valid code so resend can't
        // be used to get a fresh 5 guesses.
        $carriedAttempts = ($recent && $recent->expires_at->isFuture())
            ? (int) $recent->attempts
            : 0;

        // Invalidate old codes and force-send a new one.
        OtpCode::where('user_id', $user->id)
            ->whereNull('verified_at')
            ->delete();

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $otp = new OtpCode;
        $otp->forceFill([
            'user_id' => $user->id,
            'code' => $code,
            'attempts' => $carriedAttempts,
            'expires_at' => now()->addMinutes(5),
        ])->save();

        $user->notify(new SendOtpCode($code, otpId: $otp->id, expiresAt: $otp->expires_at));

        return response()->json([
            'success' => true,
            'message' => 'A new code has been requested. Check your email shortly.',
            'data' => null,
        ]);
    }

    /**
     * Verify a submitted OTP code and issue the auth exchange code.
     *
     * POST /api/auth/otp/verify
     */
    public function verify(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => 'required|uuid|exists:users,id',
            'code' => 'required|digits:6',
            'pending' => 'required|string|size:40',
        ]);

        return DB::transaction(function () use ($request) {
            $user = User::whereKey($request->input('user_id'))->lockForUpdate()->firstOrFail();

            return $this->verifyLocked($request, $user);
        });
    }

    private function verifyLocked(Request $request, User $user): JsonResponse
    {
        if (! $this->pendingMatches($request)) {
            return $this->expiredSession();
        }

        if (! $user->canLogin()) {
            return $this->rejectInactive($user);
        }

        $otp = OtpCode::where('user_id', $user->id)
            ->whereNull('verified_at')
            ->latest()
            ->first();

        if (! $otp) {
            return response()->json([
                'success' => false,
                'message' => 'No pending verification found. Please log in again.',
                'data' => null,
            ], 404);
        }

        if ($otp->expires_at->lessThanOrEqualTo(now())) {
            return response()->json([
                'success' => false,
                'message' => 'This code has expired. Please log in again.',
                'data' => null,
            ], 422);
        }

        if ($otp->attempts >= 5) {
            return response()->json([
                'success' => false,
                'message' => 'Too many attempts. Please log in again.',
                'data' => null,
            ], 429);
        }

        if (! Hash::check($request->string('code')->toString(), (string) $otp->code)) {
            $otp->increment('attempts');

            return response()->json([
                'success' => false,
                'message' => 'Invalid code.',
                'data' => null,
            ], 422);
        }

        $otp->update(['verified_at' => now()]);

        // Isang beses lang magagamit ang pending token.
        Cache::forget("auth_pending:{$request->input('pending')}");
        Cache::forget("auth_pending_sent:{$request->input('pending')}");

        $user->tokens()->delete();
        $token = $user->createToken('alrm-spa', ['*'], now()->addHours(8))->plainTextToken;
        $code = Str::random(40);
        Cache::put("auth_exchange:{$code}", $token, now()->addSeconds(60));

        $cookie = TrustedDeviceManager::remember($request, $user);

        return response()->json([
            'success' => true,
            'message' => 'OK',
            'data' => ['exchange_code' => $code],
        ])->cookie($cookie);
    }
}
