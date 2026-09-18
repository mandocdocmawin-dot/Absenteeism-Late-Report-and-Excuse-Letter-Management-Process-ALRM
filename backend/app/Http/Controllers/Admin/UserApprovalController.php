<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditLoggerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserApprovalController extends Controller
{
    /**
     * Roles an Administrator is allowed to assign here.
     * 'student' is intentionally excluded — students are auto-assigned
     * and never touched through this controller.
     */
    private const ASSIGNABLE_ROLES = ['instructor', 'program_head', 'administrator'];

    public function __construct(
        protected AuditLoggerService $auditLogger,
    ) {}

    /**
     * List all staff accounts (everyone except students), so the Admin
     * can see current role assignments and pick who to promote/reassign.
     *
     * Staff accounts are auto-approved with role=instructor on first
     * login (see AuthController::callback) — nobody sits in a "pending,
     * no role yet" state anymore. This list exists so the Admin can find
     * someone who needs a DIFFERENT role than their instructor default
     * (e.g. a Program Head, or another Administrator).
     *
     * GET /api/admin/users
     * Optional filter: ?role=instructor|program_head|administrator
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::query()
            ->where('role', '!=', 'student')
            ->whereNotNull('role');

        if ($request->filled('role')) {
            $request->validate([
                'role' => ['string', Rule::in(self::ASSIGNABLE_ROLES)],
            ]);
            $query->where('role', $request->query('role'));
        }

        $users = $query->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'message' => 'OK',
            'data'    => $users,
        ]);
    }

    /**
     * Change an existing staff member's role — e.g. promote an
     * instructor to program_head, or grant administrator access.
     *
     * This replaces the old "approve a pending user" flow: since staff
     * accounts are now auto-approved with role=instructor at first
     * login, there's no pending/unassigned state left to approve.
     * What's left is reassignment — for staff who wear more than one
     * hat (per the "instructor who is also a Program Head" case), the
     * Admin is the one who decides and applies the change here.
     *
     * PATCH /api/admin/users/{user}/role
     */
    public function updateRole(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['required', 'string', Rule::in(self::ASSIGNABLE_ROLES)],
        ]);

        // Guard: this endpoint is for staff only. Students are never
        // touched here — their role is locked in at first login and
        // isn't something an Admin reassigns through this flow.
        if ($user->role === 'student' || $user->role === null) {
            return response()->json([
                'success' => false,
                'message' => 'This endpoint only reassigns existing staff roles (instructor, program_head, administrator).',
                'data'    => null,
            ], 409);
        }

        // Guard: prevent an admin from changing their own role through
        // this endpoint — avoids an admin accidentally locking themself
        // out, and keeps "who changed my access" unambiguous in the
        // audit log (someone else always has to make that call).
        if ($user->id === $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot change your own role through this endpoint.',
                'data'    => null,
            ], 403);
        }

        $previousRole = $user->role;

        // No-op guard: nothing to do, nothing to log, if the role isn't
        // actually changing.
        if ($previousRole === $validated['role']) {
            return response()->json([
                'success' => false,
                'message' => "User already has the '{$validated['role']}' role.",
                'data'    => null,
            ], 409);
        }

        $user->role = $validated['role'];
        $user->save();

        $this->auditLogger->log(
            "role_changed:{$previousRole}->{$validated['role']}",
            'users',
            $user->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Role updated.',
            'data'    => $user,
        ]);
    }
}