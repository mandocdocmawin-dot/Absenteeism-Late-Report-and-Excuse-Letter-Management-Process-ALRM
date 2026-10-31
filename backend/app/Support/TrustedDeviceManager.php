<?php

namespace App\Support;

/**
 * Trusted-device cookie (httpOnly, SameSite=Lax).
 *
 * Works because the Vercel frontend proxies /api/* to the Render
 * backend (vercel.json rewrite), so the browser treats the cookie
 * as first-party. Always call the API via relative /api URLs;
 * never hit the onrender.com domain directly from the frontend.
 */


use App\Models\TrustedDevice;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Cookie;

class TrustedDeviceManager
{
    private const COOKIE_NAME = 'alrm_device';
    private const LIFETIME_DAYS = 60;

    /**
     * Check if the incoming request carries a valid trusted-device cookie
     * for this exact user. Also touches last_used_at on a hit.
     */
    public static function isTrusted(Request $request, User $user): bool
    {
        $raw = $request->cookie(self::COOKIE_NAME);

        if (! $raw) {
            return false;
        }

        // Cookie format: "{deviceRecordId}|{plainSecret}"
        [$id, $secret] = array_pad(explode('|', $raw, 2), 2, null);

        if (! $id || ! $secret) {
            return false;
        }

        $device = TrustedDevice::where('id', $id)
            ->where('user_id', $user->id)
            ->where('expires_at', '>', now())
            ->first();

        if (! $device || ! Hash::check($secret, $device->token_hash)) {
            return false;
        }

        $device->update(['last_used_at' => now()]);

        return true;
    }

    /**
     * Issue a brand-new trusted-device record + cookie after a
     * successful OTP verification.
     */
    public static function remember(Request $request, User $user): Cookie
    {
        $secret = Str::random(64);

        $device = TrustedDevice::create([
            'user_id'      => $user->id,
            'token_hash'   => Hash::make($secret),
            'user_agent'   => substr((string) $request->userAgent(), 0, 255),
            'ip_address'   => $request->ip(),
            'last_used_at' => now(),
            'expires_at'   => now()->addDays(self::LIFETIME_DAYS),
        ]);

        $isProduction = app()->environment('production');

        return cookie(
            name: self::COOKIE_NAME,
            value: "{$device->id}|{$secret}",
            minutes: self::LIFETIME_DAYS * 24 * 60,
            path: '/',
            domain: null,
            secure: $isProduction,   // true sa production (HTTPS), false sa local (HTTP)
            httpOnly: true,          // JS can't read it, mitigates XSS token theft
            sameSite: 'lax',         // first-party na via Vercel proxy
        );
    }
}
