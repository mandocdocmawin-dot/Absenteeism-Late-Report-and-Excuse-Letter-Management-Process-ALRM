<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\OtpCode;
use App\Models\User;
use App\Notifications\SendOtpCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class OtpController extends Controller
{
    /**
     * Generate and email a fresh OTP code for the given user.
     */
    public static function issue(User $user): void
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

        OtpCode::create([
            'user_id'    => $user->id,
            'code'       => $code,
            'expires_at' => now()->addMinutes(5),
        ]);

        $user->notify(new SendOtpCode($code));
    }

    public function resend(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => 'required|string|exists:users,id',
        ]);

        $user = User::findOrFail($request->string('user_id'));

        $recent = OtpCode::where('user_id', $user->id)
            ->whereNull('verified_at')
            ->latest()
            ->first();

        if ($recent) {
            $secondsSinceLastSend = $recent->created_at->diffInSeconds(now());

            if ($secondsSinceLastSend < 30) {
                $waitTime = 30 - $secondsSinceLastSend;

                return response()->json([
                    'success' => false,
                    'message' => "Please wait {$waitTime} seconds before requesting another code.",
                    'data'    => ['retry_after' => $waitTime],
                ], 429);
            }
        }

        // Invalidate old codes and force-send a new one.
        OtpCode::where('user_id', $user->id)
            ->whereNull('verified_at')
            ->delete();

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        OtpCode::create([
            'user_id'    => $user->id,
            'code'       => $code,
            'expires_at' => now()->addMinutes(5),
        ]);

        $user->notify(new SendOtpCode($code));

        return response()->json([
            'success' => true,
            'message' => 'A new code has been sent.',
            'data'    => null,
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
            'user_id' => 'required|string|exists:users,id',
            'code'    => 'required|string',
        ]);

        $otp = OtpCode::where('user_id', $request->string('user_id'))
            ->whereNull('verified_at')
            ->latest()
            ->first();

        if (! $otp) {
            return response()->json([
                'success' => false, 
                'message' => 'No pending verification found. Please log in again.',
                'data'    => null,
            ], 404);
        }

        if ($otp->expires_at->isPast()) {
            return response()->json([
                'success' => false,
                'message' => 'This code has expired. Please log in again.',
                'data'    => null,
            ], 422);
        }

        if ($otp->attempts >= 5) {
            return response()->json([
                'success' => false,
                'message' => 'Too many attempts. Please log in again.',
                'data'    => null,
            ], 429);
        }

        if ($otp->code !== $request->string('code')->toString()) {
            $otp->increment('attempts');

            return response()->json([
                'success' => false,
                'message' => 'Invalid code.',
                'data'    => null,
            ], 422);
        }

        $otp->update(['verified_at' => now()]);

        $user = User::findOrFail($request->string('user_id'));
        $user->tokens()->delete();
        $token = $user->createToken('alrm-spa')->plainTextToken;
        $code = Str::random(40);
        Cache::put("auth_exchange:{$code}", $token, now()->addSeconds(60));

        return response()->json([
            'success' => true,
            'message' => 'OK',
            'data'    => ['exchange_code' => $code],
        ]);
    }
}
