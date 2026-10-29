<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\AttendanceTracker;
use App\Models\Enrollment;
use App\Models\ExcuseRequest;
use App\Models\UserNotification;
use App\Services\AttendanceThresholdNotifier;
use App\Services\AuditLoggerService;
use App\Support\BoundedCollection;
use Illuminate\Http\Request as HttpRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

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
        $requests = ExcuseRequest::forInstructor(Auth::id())->with('enrollment.student', 'enrollment.class', 'teachingAssignment')
            ->latest();

        return BoundedCollection::respond($requests);
    }

    /**
     * Approve, Note, or Invalidate a request (per BPM flowchart: Approved/Noted
     * both resolve to "VALID" — student is excused; Invalid counts against
     * the attendance tracker).
     */
    public function decide(HttpRequest $httpRequest, ExcuseRequest $request)
    {
        $validated = $httpRequest->validate([
            'status' => ['required', 'in:approved,noted,invalid'],
        ]);

        return DB::transaction(function () use ($request, $validated) {
            $request = ExcuseRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();
            $this->authorize('decide', $request);
            abort_if($request->status !== 'pending', 409, 'This request has already been decided.');
            Enrollment::whereKey($request->enrollment_id)->lockForUpdate()->firstOrFail();

            $request->update([
                'status' => $validated['status'],
                'reviewed_by' => Auth::id(),
                'date_reviewed' => now(),
            ]);

            $this->auditLogger->log(
                'decided_request_'.$validated['status'],
                'requests',
                $request->id
            );

            if ($validated['status'] === 'invalid') {
                $this->applyToTracker($request);
            }

            $request->loadMissing('enrollment.class.instructor');

            $instructorName = $request->class_snapshot['instructor']['name'] ?? 'your instructor';
            $typeLabel = $request->type === 'late' ? 'late' : 'absence';

            $dateLabel = $request->start_date_of_absence
                ? ' for '.Carbon::parse($request->start_date_of_absence)->format('M j')
                : '';

            $statusLabel = match ($validated['status']) {
                'approved' => 'approved',
                'noted' => 'noted',
                'invalid' => 'marked invalid',
            };

            UserNotification::create([
                'user_id' => $request->enrollment->student_id,
                'request_id' => $request->id,
                'type' => 'request_decision',
                'message' => "Your {$typeLabel} request{$dateLabel} was {$statusLabel} by {$instructorName}.",
                'channel' => 'in_app',
                'date_sent' => now(),
                'is_read' => false,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Decision recorded.',
                'data' => $request->fresh(),
            ]);
        });
    }

    /**
     * Increment the enrollment's attendance tracker and recompute status.
     * Warning, critical and IR alerts are delivered to the program heads through the
     * shared notifier, including a consultation flag at the critical threshold.
     */
    private function applyToTracker(ExcuseRequest $request): void
    {
        [$tracker, $previousStatus] = DB::transaction(function () use ($request) {
            $tracker = AttendanceTracker::where('enrollment_id', $request->enrollment_id)
                ->lockForUpdate()
                ->first();

            if (! $tracker) {
                $tracker = AttendanceTracker::create([
                    'enrollment_id' => $request->enrollment_id,
                    'total_lates' => 0,
                    'total_absences' => 0,
                    'converted_absences' => 0,
                    'status' => 'safe',
                ]);
                $tracker = AttendanceTracker::where('enrollment_id', $request->enrollment_id)
                    ->lockForUpdate()
                    ->first();
            }

            $previousStatus = $tracker->status;

            if ($request->type === 'late') {
                $tracker->total_lates++;
            } else {
                $class = $request->historicalClass();
                $tracker->absence_hours = ($tracker->absence_hours ?? $tracker->total_absences * $class->unitsPerMeeting())
                    + $class->absenceHoursForPeriod($request->start_date_of_absence, $request->end_date_of_absence);
                $tracker->total_absences++;
            }

            $tracker->save();
            $tracker->recompute();

            return [$tracker, $previousStatus];
        });

        if ($tracker->status === $previousStatus) {
            return;
        }

        app(AttendanceThresholdNotifier::class)->notify($tracker, $request);
    }
}
