<?php

namespace App\Console\Commands;

use App\Models\AttendanceTracker;
use App\Models\ExcuseRequest;
use App\Models\FollowupFlag;
use App\Models\UserNotification;
use Illuminate\Console\Command;

class RunAttendanceAutomation extends Command
{
    protected $signature = 'alrm:process-automation';

    protected $description = 'Flag overdue pending requests and fire attendance threshold notifications.';

    public function handle(): int
    {
        $flagged  = $this->flagOverdueRequests();
        $notified = $this->fireThresholdNotifications();

        $this->info("Flagged {$flagged} overdue request(s). Sent {$notified} threshold notification(s).");

        return self::SUCCESS;
    }

    /**
     * FOLLOWUP_FLAGS: a request sitting 'pending' past the response window
     * gets escalated to the student's Program Head. Not tied to IR crossing
     * anymore — see §9.1.
     */
    private function flagOverdueRequests(): int
    {
        $windowHours = (int) env('FOLLOWUP_RESPONSE_WINDOW_HOURS', 48);

        $overdue = ExcuseRequest::where('status', 'pending')
            ->where('date_submitted', '<=', now()->subHours($windowHours))
            ->whereDoesntHave('followupFlag')
            ->with('enrollment.student.program.programHead')
            ->get();

        $flagged = 0;

        foreach ($overdue as $request) {
            $enrollment = $request->enrollment;

            if (! $enrollment || ! $enrollment->student) {
                $this->warn("Skipped request #{$request->id}: missing enrollment/student data.");
                continue;
            }

            $programHead = $enrollment->student->program?->programHead;

            if (! $programHead) {
                $this->warn("Skipped request #{$request->id}: no Program Head assigned to escalate to.");
                continue;
            }

            FollowupFlag::create([
                'request_id'   => $request->id,
                'flagged_date' => now(),
                'escalated_to' => $programHead->id,
                'status'       => 'open',
            ]);

            UserNotification::create([
                'user_id'    => $programHead->id,
                'request_id' => $request->id,
                'type'       => 'followup_flag',
                'message'    => "A {$request->type} request has gone unanswered past the response window.",
                'channel'    => 'in_app',
                'date_sent'  => now(),
                'is_read'    => false,
            ]);

            $flagged++;
        }

        return $flagged;
    }

    /**
     * THRESHOLD_NOTIFICATIONS: AttendanceTracker::recompute() already sets
     * status to 'warning' (converted_absences >= 2) or 'IR' (>= 3). This job
     * just needs to notify once per threshold crossing, guarded by the
     * warning_notified_at / ir_notified_at timestamps so re-running the
     * command never double-sends.
     */
    private function fireThresholdNotifications(): int
    {
        $notified = 0;

        $warningTrackers = AttendanceTracker::where('status', 'warning')
            ->whereNull('warning_notified_at')
            ->with('enrollment.student.program.programHead', 'enrollment.class.instructor')
            ->get();

        foreach ($warningTrackers as $tracker) {
            $sent = $this->notifyThreshold(
                $tracker,
                'attendance_warning',
                "Student has reached {$tracker->converted_absences} converted absence(s) — Warning threshold."
            );

            if ($sent) {
                $tracker->forceFill(['warning_notified_at' => now()])->save();
                $notified++;
            }
        }

        $irTrackers = AttendanceTracker::where('status', 'IR')
            ->whereNull('ir_notified_at')
            ->with('enrollment.student.program.programHead', 'enrollment.class.instructor')
            ->get();

        foreach ($irTrackers as $tracker) {
            $sent = $this->notifyThreshold(
                $tracker,
                'attendance_ir',
                "Student has reached {$tracker->converted_absences} converted absence(s) — Incident Report (IR) threshold."
            );

            if ($sent) {
                $tracker->forceFill(['ir_notified_at' => now()])->save();
                $notified++;
            }
        }

        return $notified;
    }

    /**
     * Notifies the instructor and/or Program Head for a tracker that crossed
     * a threshold. Returns false (and logs a warning) instead of throwing
     * when relationships are missing, so one bad record never halts the run.
     */
    private function notifyThreshold(AttendanceTracker $tracker, string $type, string $message): bool
    {
        $enrollment = $tracker->enrollment;

        if (! $enrollment) {
            $this->warn("Skipped tracker #{$tracker->id}: no enrollment found.");
            return false;
        }

        $instructor  = $enrollment->class?->instructor;
        $programHead = $enrollment->student?->program?->programHead;

        $recipients = array_filter([$instructor, $programHead]);

        if (empty($recipients)) {
            $this->warn("Skipped tracker #{$tracker->id}: no instructor or Program Head found to notify.");
            return false;
        }

        foreach ($recipients as $recipient) {
            UserNotification::create([
                'user_id'    => $recipient->id,
                'request_id' => null,
                'type'       => $type,
                'message'    => $message,
                'channel'    => 'in_app',
                'date_sent'  => now(),
                'is_read'    => false,
            ]);
        }

        return true;
    }
}