<?php

namespace App\Http\Controllers\ProgramHead;

use App\Http\Controllers\Controller;
use App\Models\FollowupFlag;
use App\Services\AuditLoggerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class FollowupFlagController extends Controller
{
    public function __construct(
        protected AuditLoggerService $auditLogger,
    ) {}

    /**
     * List follow-up flags escalated to the authenticated Program Head.
     * Administrator sees all flags.
     *
     * GET /api/program-head/followup-flags
     */
    public function index(): JsonResponse
    {
        $query = FollowupFlag::with('request.enrollment.student', 'escalatedTo');

        if (Auth::user()->role !== 'administrator') {
            $query->where('escalated_to', Auth::id());
        }

        $flags = $query->latest('flagged_date')->get();

        return response()->json([
            'success' => true,
            'message' => null,
            'data'    => $flags,
        ]);
    }

    /**
     * Mark a follow-up flag as resolved.
     *
     * PATCH /api/program-head/followup-flags/{followupFlag}/resolve
     */
    public function resolve(FollowupFlag $followupFlag): JsonResponse
    {
        $this->authorize('update', $followupFlag);

        if ($followupFlag->status === 'resolved') {
            return response()->json([
                'success' => false,
                'message' => 'This flag has already been resolved.',
                'data'    => null,
            ], 409);
        }

        $followupFlag->update(['status' => 'resolved']);

        $this->auditLogger->log('resolved_followup_flag', 'followup_flags', $followupFlag->id);

        return response()->json([
            'success' => true,
            'message' => 'Follow-up flag resolved.',
            'data'    => $followupFlag->fresh(),
        ]);
    }
}