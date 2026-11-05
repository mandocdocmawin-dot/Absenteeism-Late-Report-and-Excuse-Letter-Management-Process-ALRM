<?php

namespace App\Services;

use App\Mail\ProgramHeadAttendanceAlertMail;
use App\Models\AttendanceTracker;
use App\Models\ExcuseRequest;
use App\Models\FollowupFlag;
use App\Models\UserNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class AttendanceThresholdNotifier
{
    /** Shared by request decisions and automation so each stage is delivered once. */
    public function notify(AttendanceTracker $tracker, ?ExcuseRequest $request = null): bool
    {
        return DB::transaction(function () use ($tracker, $request) {
            $tracker = AttendanceTracker::whereKey($tracker->id)->lockForUpdate()->firstOrFail();
            $column = match ($tracker->status) {
                'warning' => 'warning_notified_at',
                'critical' => 'critical_notified_at',
                'IR' => 'ir_notified_at',
                default => null,
            };
            if ($column === null || $tracker->{$column} !== null) {
                return false;
            }

            $enrollment = $tracker->enrollment;
            $student = $enrollment?->student;
            $class = $enrollment?->class;
            $program = $class?->program;
            if (! $student || ! $class || ! $program) {
                return false;
            }

            $heads = $program->notificationHeads();
            $recipients = $heads->concat([$student, $class->instructor])
                ->filter(fn ($user) => $user && $user->status === 'approved')
                ->unique('id');
            if ($recipients->isEmpty()) {
                return false;
            }

            $used = $tracker->unitsUsed();
            $limit = $tracker->allowedUnits();
            $percentage = $tracker->absencePercentage();
            $remaining = $tracker->remainingSemesterPercentage();
            $stage = match ($tracker->status) {
                'warning' => 'preventive absence threshold',
                'critical' => 'critical absence threshold',
                'IR' => 'IR drop limit',
            };
            $message = "{$student->name} reached the {$stage} in {$class->subject_name} ({$percentage}% of semester class hours; {$used} of {$limit} allowable units; {$remaining}% of semester hours remaining before the IR limit).";
            if (in_array($tracker->status, ['critical', 'IR'], true)) {
                $message .= ' Consultation is required.';
            }

            // The shared path also creates consultation flags for automation runs.
            if (in_array($tracker->status, ['critical', 'IR'], true)) {
                $flagRequest = $request ?? ExcuseRequest::where('enrollment_id', $tracker->enrollment_id)
                    ->where('status', 'invalid')->latest('date_reviewed')->first();
                if ($flagRequest && $heads->isNotEmpty()) {
                    $head = $heads->firstWhere('id', $program->program_head_id) ?? $heads->first();
                    FollowupFlag::firstOrCreate(['request_id' => $flagRequest->id], [
                        'flagged_date' => now(),
                        'escalated_to' => $head->id,
                        'status' => 'open',
                    ]);
                }
            }

            $emailTargets = [];

            foreach ($recipients as $recipient) {
                UserNotification::create([
                    'user_id' => $recipient->id,
                    'request_id' => $request?->id,
                    'type' => match ($tracker->status) {
                        'warning' => 'threshold_warning',
                        'critical' => 'threshold_critical',
                        'IR' => 'ir_escalation',
                    },
                    'message' => $message,
                    'channel' => 'in_app',
                    'date_sent' => now(),
                    'is_read' => false,
                ]);

                $audience = $heads->contains('id', $recipient->id) ? 'program_head'
                    : ($recipient->id === $student->id ? 'student' : 'instructor');
                if ($audience === 'instructor') {
                    $allowlist = array_map(fn ($email) => strtolower(trim($email)), config('mail.instructor_notify_allowlist', []));
                    if ($allowlist !== [] && ! in_array(strtolower(trim($recipient->email)), $allowlist, true)) {
                        continue;
                    }
                }
                $testRecipient = trim((string) config("mail.{$audience}_test_recipient", ''));
                if ($testRecipient === '') {
                    $testRecipient = trim((string) config('mail.test_recipient', ''));
                }
                $email = $testRecipient !== '' ? $testRecipient : $recipient->email;
                if ($recipient->canReceiveEmailNotifications() && ! isset($emailTargets[strtolower($email)])) {
                    $emailTargets[strtolower($email)] = true;
                    Mail::to($email, $testRecipient !== '' ? null : $recipient->name)->queue(
                        (new ProgramHeadAttendanceAlertMail(
                            $recipient->name,
                            $student->name, $class->subject_name,
                            $program->program_name, $tracker->status, $message, $used, $limit,
                        ))->afterCommit(),
                    );
                }
            }

            $tracker->forceFill([$column => now()])->save();

            return true;
        });
    }
}
