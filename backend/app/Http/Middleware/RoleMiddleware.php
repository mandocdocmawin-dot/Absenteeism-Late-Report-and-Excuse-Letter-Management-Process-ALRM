<?php

namespace App\Http\Middleware;

use App\Models\Program;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
                'data'    => null,
            ], 401);
        }

        if ($user->status !== 'approved') {
            return response()->json([
                'success' => false,
                'message' => 'Your account is not active. Please contact an administrator.',
                'data'    => null,
            ], 403);
        }

        $hasDirectRole = $user->role && in_array($user->role, $roles, true);

        $hasProgramHeadOverride = ! $hasDirectRole
            && in_array('program_head', $roles, true)
            && Program::where('program_head_id', $user->id)->exists();

        if (! $hasDirectRole && ! $hasProgramHeadOverride) {
            return response()->json([
                'success' => false,
                'message' => 'You are not authorized to access this resource.',
                'data'    => null,
            ], 403);
        }

        return $next($request);
    }
}