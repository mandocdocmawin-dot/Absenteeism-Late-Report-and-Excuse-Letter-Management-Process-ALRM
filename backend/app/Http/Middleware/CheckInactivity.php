<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class CheckInactivity
{
    private const IDLE_LIMIT_MINUTES = 15;

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        $token = $user->currentAccessToken();

        if (! $token || ! $token->id) {
            return $next($request);
        }

        $cacheKey = "last_activity:token:{$token->id}";
        $lastActivityTimestamp = Cache::get($cacheKey);

        if ($lastActivityTimestamp !== null) {
            $lastActivity = Carbon::createFromTimestamp($lastActivityTimestamp);

            if (now()->diffInMinutes($lastActivity) >= self::IDLE_LIMIT_MINUTES) {
                $token->delete();
                Cache::forget($cacheKey);

                return response()->json([
                    'success' => false,
                    'message' => 'Session expired due to inactivity. Please log in again.',
                    'data'    => null,
                ], 401);
            }
        }

        Cache::put($cacheKey, now()->timestamp, self::IDLE_LIMIT_MINUTES + 5);

        return $next($request);
    }
}