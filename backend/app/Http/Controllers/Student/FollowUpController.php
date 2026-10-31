<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Mail\InstructorFollowUpMail;
use App\Models\ExcuseRequest;
use App\Models\FollowupFlag;
use App\Models\UserNotification;
use App\Services\AuditLoggerService;
use App\Services\MailDeliveryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class FollowUpController extends Controller
{
    private const COOLDOWN_HOURS = 24;

    public function __construct(protected AuditLoggerService $auditLogger) {}

    /**
     * Student follow-up sa instructor para sa pending request.
     *
     * POST /api/requests/{request}/follow-up
     */
    public function store(ExcuseRequest $request): JsonResponse
    {
        return DB::transaction(function () use ($request) {
            $request = ExcuseRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();
            $request->load('enrollment.student', 'enrollment.class.instructor', 'enrollment.class.program');

            $enrollment = $request->enrollment;
            $class = $enrollment->class;
            $instructor = $request->teachingAssignment?->ended_at === null
                ? $request->teachingAssignment?->instructor : null;

            if ($enrollment->student_id !== Auth::id()) {
                return $this->fail('Unauthorized.', 403);
            }

            if ($request->status !== 'pending') {
                return $this->fail('Only pending requests can be followed up.', 422);
            }

            if (! $instructor?->email || ! $instructor->canLogin()) {
                return $this->fail('No active instructor found for this class.', 422);
            }

            $last = FollowupFlag::where('request_id', $request->id)
                ->latest('flagged_date')
                ->first();

            if ($last && $last->flagged_date->gt(now()->subHours(self::COOLDOWN_HOURS))) {
                return $this->fail(
                    'You already followed up. You can follow up again '.
                    $last->flagged_date->copy()->addHours(self::COOLDOWN_HOURS)->diffForHumans().'.',
                    429
                );
            }

            $flag = FollowupFlag::create([
                'request_id' => $request->id,
                'flagged_date' => now(),
                'escalated_to' => $instructor->id,
                'status' => 'open',
            ]);

            $this->auditLogger->log('followed_up_request', 'followup_flags', $flag->id);

            $count = FollowupFlag::where('request_id', $request->id)->count();

            UserNotification::create([
                'user_id' => $instructor->id,
                'request_id' => $request->id,
                'type' => 'request_followup',
                'message' => "{$enrollment->student->name} followed up on their {$request->type} request for {$class->subject_name}.",
                'channel' => 'in_app',
                'date_sent' => now(),
                'is_read' => false,
            ]);

            app(MailDeliveryService::class)->queue($instructor, new InstructorFollowUpMail(
                instructor: $instructor,
                student: $enrollment->student,
                class: $class,
                excuseRequest: $request,
                reviewUrl: rtrim(config('app.frontend_url'), '/').'/instructor/class-requests',
                followupCount: $count,
            ), 'instructor');

            return response()->json([
                'success' => true,
                'message' => 'Follow-up recorded. Your instructor has been notified in the system.',
                'data' => $flag,
            ], 201);
        });
    }

    private function fail(string $message, int $code): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message, 'data' => null], $code);
    }
}
