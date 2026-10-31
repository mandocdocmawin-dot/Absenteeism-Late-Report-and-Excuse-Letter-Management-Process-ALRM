<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\FollowupFlag;
use App\Services\AuditLoggerService;
use App\Support\BoundedCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class FollowupController extends Controller
{
    public function __construct(protected AuditLoggerService $auditLogger) {}

    /** GET /api/instructor/followups */
    public function index(): JsonResponse
    {
        $flags = FollowupFlag::with('request.enrollment.student', 'request.enrollment.class', 'request.teachingAssignment')
            ->where('escalated_to', Auth::id())
            ->where('status', 'open')
            ->latest('flagged_date');

        return BoundedCollection::respond($flags);
    }

    /** PATCH /api/instructor/followups/{followupFlag}/resolve */
    public function resolve(FollowupFlag $followupFlag): JsonResponse
    {
        $this->authorize('update', $followupFlag);

        if ($followupFlag->status === 'resolved') {
            return response()->json(['success' => false, 'message' => 'Already resolved.', 'data' => null], 409);
        }

        $followupFlag->update(['status' => 'resolved']);
        $this->auditLogger->log('resolved_followup_flag', 'followup_flags', $followupFlag->id);

        return response()->json(['success' => true, 'message' => 'Follow-up resolved.', 'data' => $followupFlag->fresh()]);
    }
}
