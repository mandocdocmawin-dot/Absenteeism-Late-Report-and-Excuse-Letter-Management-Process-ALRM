<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Program;
use App\Services\AuditLoggerService;
use App\Support\BoundedCollection;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProgramController extends Controller
{
    /**
     * Roles eligible to be set as a Program's program_head_id.
     *
     * Deliberately NOT limited to role === 'program_head'. A staff
     * member who heads a program while still teaching keeps
     * role = 'instructor' (see RoleMiddleware's program-head override
     * and ExcuseRequestPolicy::view(), both of which grant Program Head
     * access via this program_head_id relationship, not the role
     * column). Literal role = 'program_head' is reserved for a non-
     * teaching program head; 'instructor' covers the "wears both hats"
     * case. Both must be accepted here or the Admin can never actually
     * assign the second, more common case.
     */
    private const HEAD_ELIGIBLE_ROLES = ['instructor', 'program_head'];

    public function __construct(
        protected AuditLoggerService $auditLogger,
    ) {}

    /**
     * GET /api/admin/programs
     */
    public function index()
    {
        $programs = Program::with('programHead')->withCount(['classes', 'users']);

        return BoundedCollection::respond($programs);
    }

    /**
     * POST /api/admin/programs
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'program_name' => ['required', 'string', 'max:255', 'unique:programs,program_name'],
            'program_head_id' => ['nullable', 'string', 'uuid', Rule::exists('users', 'id')->whereIn('role', self::HEAD_ELIGIBLE_ROLES)],
        ]);

        $program = Program::create($validated);
        $this->auditLogger->log('created_program', 'programs', $program->id);

        return response()->json([
            'success' => true,
            'message' => 'Program created.',
            'data' => $program,
        ], 201);
    }

    /**
     * GET /api/admin/programs/{program}
     */
    public function show(Program $program)
    {
        return response()->json([
            'success' => true,
            'message' => null,
            'data' => $program->load('programHead', 'classes', 'users'),
        ]);
    }

    /**
     * PUT/PATCH /api/admin/programs/{program}
     */
    public function update(Request $request, Program $program)
    {
        $validated = $request->validate([
            'program_name' => ['sometimes', 'string', 'max:255', Rule::unique('programs', 'program_name')->ignore($program->id)],
            'program_head_id' => ['sometimes', 'nullable', 'string', 'uuid', Rule::exists('users', 'id')->whereIn('role', self::HEAD_ELIGIBLE_ROLES)],
        ]);

        $program->update($validated);
        $this->auditLogger->log('updated_program', 'programs', $program->id);

        return response()->json([
            'success' => true,
            'message' => 'Program updated.',
            'data' => $program,
        ]);
    }

    /**
     * DELETE /api/admin/programs/{program}
     */
    public function destroy(Program $program)
    {
        if ($program->classes()->exists() || $program->users()->exists() || $program->curricula()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete a program that still has classes, users, or curriculum history.',
                'data' => null,
            ], 409);
        }

        $programId = $program->id;
        $program->delete();

        $this->auditLogger->log('deleted_program', 'programs', $programId);

        return response()->json([
            'success' => true,
            'message' => 'Program deleted.',
            'data' => null,
        ]);
    }
}
