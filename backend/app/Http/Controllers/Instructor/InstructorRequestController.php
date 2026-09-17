<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\AttendanceTracker;
use App\Models\ExcuseRequest;
use App\Models\FollowupFlag;
use App\Models\UserNotification;
use App\Services\AuditLoggerService;
use Illuminate\Http\Request as HttpRequest;
use Illuminate\Support\Facades\Auth;

class InstructorRequestController extends Controller
{
    public function __construct(
        protected AuditLoggerService $auditLogger,
    ) {}
    /**
     * List requests for classes taught by the authenticated instructor.
     */
    public function index()
    {
        $requests = ExcuseRequest::whereHas('enrollment.class', function ($q) {
            $q->where('instructor_id', Auth::id());
        })->with('enrollment.student', 'enrollment.class')
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'message' => null,
            'data'    => $requests,
        ]);
    }

    /**
     * Approve, Note, or Invalidate a request (per BPM flowchart: Approved/Noted
     * both resolve to "VALID" — student is excused; Invalid counts against
     * the attendance tracker).
     */
    public function decide(HttpRequest $httpRequest, ExcuseRequest $request)
    {
        $this->authorize('decide', $request);

        if ($request->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'This request has already been decided.',
                'data'    => null,
            ], 409);
        }

        $validated = $httpRequest->validate([
            'status' => ['required', 'in:approved,noted,invalid'],
        ]);

        $request->update([
            'status'        => $validated['status'],
            'reviewed_by'   => Auth::id(),
            'date_reviewed' => now(),
        ]);

        $this->auditLogger->log(
            'decided_request_' . $validated['status'],
            'requests',
            $request->id
        );

        if ($validated['status'] === 'invalid') {
            $this->applyToTracker($request);
        }

        UserNotification::create([
            'user_id'    => $request->enrollment->student_id,
            'request_id' => $request->id,
            'type'       => 'request_decision',
            'message'    => "Your {$request->type} request has been {$validated['status']}.",
            'channel'    => 'in_app',
            'date_sent'  => now(),
            'is_read'    => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Decision recorded.',
            'data'    => $request->fresh(),
        ]);
    }

    /**
     * Increment the enrollment's attendance tracker and recompute status.
     * Per stakeholder interviews: alerts fire at BOTH the warning stage (2)
     * and IR stage (3), and go to both the Instructor and Program Head —
     * not just on IR, not just to the Program Head. FollowupFlag (escalation
     * record) is created only on the IR crossing.
     */
    private function applyToTracker(ExcuseRequest $request): void
    {
        $tracker = AttendanceTracker::firstOrCreate(
            ['enrollment_id' => $request->enrollment_id],
            ['total_lates' => 0, 'total_absences' => 0, 'converted_absences' => 0, 'status' => 'safe']
        );

        if ($request->type === 'late') {
            $tracker->total_lates++;
        } else {
            $tracker->total_absences++;
        }

        $tracker->save();

        $previousStatus = $tracker->status;
        $tracker->recompute();

        if ($tracker->status === $previousStatus) {
            return; // no new threshold crossed
        }

        $student     = $request->enrollment->student;
        $instructor  = $request->enrollment->class->instructor;
        $programHead = $student->program?->programHead;

        $recipients = array_filter([$instructor, $programHead]);

        if ($tracker->status === 'warning') {
            $this->notifyAll(
                $recipients,
                $request,
                'threshold_warning',
                "{$student->name} has reached 2 converted absences (warning)."
            );
        }

        if ($tracker->status === 'IR') {
            FollowupFlag::create([
                'request_id'   => $request->id,
                'flagged_date'   => now(),
                'escalated_to' => $programHead?->id,
                'status'       => 'pending',
            ]);

            $this->notifyAll(
                $recipients,
                $request,
                'ir_escalation',
                "{$student->name} has reached IR status (3 converted absences) and needs follow-up."
            );
        }
    }

    /**
     * Fan out the same notification to a set of recipients (instructor, program head).
     */
    private function notifyAll(array $recipients, ExcuseRequest $request, string $type, string $message): void
    {
        foreach ($recipients as $recipient) {
            UserNotification::create([
                'user_id'    => $recipient->id,
                'request_id' => $request->id,
                'type'       => $type,
                'message'    => $message,
                'channel'    => 'in_app',
                'date_sent'  => now(),
                'is_read'    => false,
            ]);
        }
    }
}
