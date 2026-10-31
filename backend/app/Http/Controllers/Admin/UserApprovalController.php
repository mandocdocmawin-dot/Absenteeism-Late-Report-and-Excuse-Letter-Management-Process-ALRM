<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Resources\UserResource;
use App\Models\Program;
use App\Models\TeachingAssignment;
use App\Models\TrustedDevice;
use App\Models\User;
use App\Services\AuditLoggerService;
use App\Support\BoundedCollection;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserApprovalController extends Controller
{
    /**
     * Roles an Administrator can hand-pick when RE-assigning an existing
     * account's role (PATCH .../role). Student accounts may be promoted
     * to program head for SQA; assigning the student role is not supported.
     */
    private const ASSIGNABLE_ROLES = ['instructor', 'program_head', 'administrator'];

    /**
     * Roles an Administrator can pre-register a NEW roster entry as
     * (POST .../users). Unlike ASSIGNABLE_ROLES above, 'student' IS
     * included here — Admin/Registrar pre-loads the roster (name +
     * institutional email + role) before that person ever signs in, so
     * the account resolves to the right role/name on their very first
     * Google login instead of falling back to defaults.
     */
    private const CREATABLE_ROLES = ['student', 'instructor', 'program_head', 'administrator'];

    public function __construct(
        protected AuditLoggerService $auditLogger,
    ) {}

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', User::class);

        $request->validate([
            'role' => ['sometimes', 'string', Rule::in(self::CREATABLE_ROLES)],
            'status' => ['sometimes', 'string', Rule::in(['pending', 'approved', 'deactivated', 'inactive'])],
        ]);

        /** @var Builder<User> $query */
        $query = User::query()->whereNotNull('role');

        if ($request->filled('role')) {
            $query->where('role', $request->query('role'));
        }

        if ($request->filled('status')) {
            $status = $request->query('status') === 'inactive'
                ? 'deactivated'
                : $request->query('status');

            $query->where('status', $status);
        }

        /** @var Builder<User> $users */
        $users = $query->with(['program', 'programs'])
            ->withExists(['headedProgram as heads_program'])
            ->orderBy('name');

        return BoundedCollection::respond($users, UserResource::class);
    }

    /**
     * Pre-register a roster entry — student, instructor, or program
     * head — before that person has ever signed in with Google.
     *
     * ALRM has no password / manual account creation (Google SSO only).
     * This just reserves the row: when the real person later logs in
     * with THIS exact institutional email, AuthController::callback()
     * matches them to it, keeps the role set here (instead of falling
     * back to the instructor/student domain default), and flips status
     * from 'pending' to 'approved'.
     *
     * POST /api/admin/users
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $email = strtolower($validated['email']);
        $domain = substr(strrchr($email, '@') ?: '', 1);

        $studentDomain = strtolower((string) config('institution.student_domain'));
        $staffDomain = strtolower((string) config('institution.staff_domain'));

        $isStudentDomain = $domain === $studentDomain;
        $isStaffDomain = $domain === $staffDomain;

        if (! $isStudentDomain && ! $isStaffDomain) {
            return response()->json([
                'success' => false,
                'message' => 'Email must be an institutional address (@'
                    .$studentDomain.' or @'.$staffDomain.').',
                'data' => null,
            ], 422);
        }

        $roleIsStudent = $validated['role'] === 'student';
        if ($roleIsStudent !== $isStudentDomain) {
            return response()->json([
                'success' => false,
                'message' => $isStudentDomain
                    ? 'This email is on the student domain and can only be pre-registered as student.'
                    : 'This email is on the staff domain and cannot be pre-registered as student.',
                'data' => null,
            ], 422);
        }

        $user = DB::transaction(function () use ($validated, $email) {
            $program = isset($validated['program_id'])
                ? Program::query()->lockForUpdate()->findOrFail($validated['program_id'])
                : null;

            // Do not silently replace a head selected in Programs.
            if ($validated['role'] === 'program_head' && $program?->program_head_id !== null) {
                throw ValidationException::withMessages(['program_id' => 'This program already has a program head. Manage its assignment in Programs.']);
            }

            $user = User::create([
                'name' => $validated['name'],
                'email' => $email,
                'role' => $validated['role'],
                'program_id' => $validated['role'] === 'student' ? $program?->id : null,
                'school_id_number' => $validated['school_id_number'] ?? null,
                'status' => 'pending',
                'password' => null,
            ]);

            if ($program && $validated['role'] === 'instructor') {
                $user->programs()->attach($program->id);
            } elseif ($program && $validated['role'] === 'program_head') {
                $program->update(['program_head_id' => $user->id]);
            }

            $this->auditLogger->log('pre_registered_user:'.$validated['role'], 'users', $user->id);

            return $user->load(['program', 'programs']);
        });

        return response()->json([
            'success' => true,
            'message' => 'User pre-registered. They will be activated automatically on their first Google sign-in.',
            'data' => new UserResource($user),
        ], 201);
    }

    /**
     * Hard-delete a user — ONLY allowed for 'pending' (never-logged-in
     * roster mistakes) or 'deactivated' (already deactivated, e.g. years
     * after they left) accounts. An 'approved'/active account can never
     * be deleted directly through this endpoint — it must be deactivated
     * first via updateStatus(), which is the deliberate speed bump: no
     * one accidentally hard-deletes a live account carrying enrollments,
     * requests, or audit history in one click.
     *
     * DELETE /api/admin/users/{user}
     */
    public function destroy(User $user): JsonResponse
    {
        Gate::authorize('delete', $user);

        if (! in_array($user->status, ['pending', 'deactivated'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only pending or deactivated accounts can be deleted. Deactivate this user first.',
                'data' => null,
            ], 409);
        }

        if ($user->classesTaught()->exists() || $user->enrollments()->exists()
            || TeachingAssignment::where('instructor_id', $user->id)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'This account has enrollment or teaching history. Keep it deactivated to preserve records.',
                'data' => null,
            ], 409);
        }

        $userId = $user->id;
        $wasPending = $user->status === 'pending';
        $user->delete();

        $this->auditLogger->log(
            $wasPending ? 'deleted_pending_user' : 'deleted_inactive_user',
            'users',
            $userId
        );

        return response()->json([
            'success' => true,
            'message' => 'User removed.',
            'data' => null,
        ]);
    }

    /**
     * Change a user's status: approve, deactivate, or reactivate.
     *
     * PATCH /api/admin/users/{user}/status
     */
    public function updateStatus(Request $request, User $user): JsonResponse
    {
        Gate::authorize('update', $user);

        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in(['approved', 'deactivated', 'inactive'])],
        ]);

        // 'inactive' is a legacy alias; the DB enum only has 'deactivated'.
        $newStatus = $validated['status'] === 'inactive' ? 'deactivated' : $validated['status'];

        if ($user->status === 'pending') {
            if (is_null($user->google_id)) {
                return response()->json([
                    'success' => false,
                    'message' => 'This account has not logged in yet (still pending). Delete the roster entry instead if it was a mistake.',
                    'data' => null,
                ], 409);
            }

            if ($newStatus !== 'approved') {
                return response()->json([
                    'success' => false,
                    'message' => 'A self-registered account awaiting approval can only be approved through this endpoint. Delete it instead to reject the registration.',
                    'data' => null,
                ], 409);
            }
        }

        if ($user->id === $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot change your own account status through this endpoint.',
                'data' => null,
            ], 403);
        }

        $previousStatus = $user->status;

        if ($previousStatus === $newStatus) {
            return response()->json([
                'success' => false,
                'message' => "User is already '{$newStatus}'.",
                'data' => null,
            ], 409);
        }

        $user->status = $newStatus;
        $user->deactivated_at = $newStatus === 'deactivated' ? now() : null;
        $user->save();

        if ($newStatus === 'deactivated') {
            $user->tokens()->delete();
            TrustedDevice::where('user_id', $user->id)->delete();
        }

        $this->auditLogger->log(
            $previousStatus === 'pending'
                ? 'approved_self_registered_user'
                : "status_changed:{$previousStatus}->{$newStatus}",
            'users',
            $user->id
        );

        $message = match (true) {
            $previousStatus === 'pending' => 'User approved.',
            $newStatus === 'deactivated' => 'User deactivated.',
            default => 'User reactivated.',
        };

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => new UserResource($user),
        ]);
    }

    /**
     * Change an existing staff member's role — e.g. promote an
     * instructor to program_head, or grant administrator access.
     *
     * PATCH /api/admin/users/{user}/role
     */
    public function updateRole(Request $request, User $user): JsonResponse
    {
        Gate::authorize('update', $user);

        $domain = strtolower(substr(strrchr($user->email, '@') ?: '', 1));
        $isPendingExternal = $user->status === 'pending'
            && ! in_array($domain, [
                strtolower((string) config('institution.student_domain')),
                strtolower((string) config('institution.staff_domain')),
            ], true);

        $validated = $request->validate([
            'role' => ['required', 'string', Rule::in($isPendingExternal ? self::CREATABLE_ROLES : self::ASSIGNABLE_ROLES)],
        ]);

        if (! $isPendingExternal
            && ($user->role === null || ($user->role === 'student' && $validated['role'] !== 'program_head'))) {
            return response()->json([
                'success' => false,
                'message' => 'This endpoint reassigns staff roles or promotes an existing student to program head.',
                'data' => null,
            ], 409);
        }

        if ($user->id === $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot change your own role through this endpoint.',
                'data' => null,
            ], 403);
        }

        $previousRole = $user->role;

        if ($previousRole === $validated['role']) {
            return response()->json([
                'success' => false,
                'message' => "User already has the '{$validated['role']}' role.",
                'data' => null,
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
            'message' => $validated['role'] === 'program_head' && ! $user->headedProgramIds()
                ? 'Role updated. Paalala: wala pang program na naka-assign sa user na ito. Itakda ito sa Programs.'
                : 'Role updated.',
            'data' => new UserResource($user),
        ]);
    }
}
