<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Re-checks the user's CURRENT status on every authenticated request, so a
 * user deactivated while holding a valid Sanctum token is cut off at once.
 */
class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->canLogin()) {
            $user->tokens()->delete();

            return response()->json([
                'success' => false,
                'message' => 'Your account is not active. Please contact an administrator.',
                'data'    => null,
            ], 403);
        }

        return $next($request);
    }
}