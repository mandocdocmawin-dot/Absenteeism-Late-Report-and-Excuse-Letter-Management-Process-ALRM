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
     * The staff roles an Administrator is allowed to assign here.
     * 'student' is intentionally excluded — students are auto-approved
     * on first login (see AuthController::callback) and never land in
     * this queue.
     */
    private const ASSIGNABLE_ROLES = ['instructor', 'program_head', 'administrator'];

    public function __construct(
        protected AuditLoggerService $auditLogger,
    ) {}

    /**
     * List staff accounts still waiting on role assignment.
     *
     * GET /api/admin/users
     */
    public function index(Request $request): JsonResponse
    {
        $users = User::query()
            ->where('status', 'pending')
            ->whereNull('role')
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'OK',
            'data'    => $users,
        ]);
    }

    /**
     * Assign a staff role to a pending user and approve them.
     * Students never appear here — they're approved automatically
     * at login, so this only ever moves a staff account from
     * status=pending to status=approved.
     *
     * PATCH /api/admin/users/{user}/approve
     */
    public function approve(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['required', 'string', Rule::in(self::ASSIGNABLE_ROLES)],
        ]);

        if ($user->status === 'approved') {
            return response()->json([
                'success' => false,
                'message' => 'This user is already approved.',
                'data'    => null,
            ], 409);
        }

        $user->role = $validated['role'];
        $user->status = 'approved';
        $user->save();

        $this->auditLogger->log('assigned_staff_role', 'users', $user->id);

        return response()->json([
            'success' => true,
            'message' => 'User approved.',
            'data'    => $user,
        ]);
    }
}