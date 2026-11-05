<?php

namespace App\Console\Commands;

use App\Models\AttendanceTracker;
use App\Models\ExcuseRequest;
use App\Models\FollowupFlag;
use App\Models\UserNotification;
use App\Services\AttendanceThresholdNotifier;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class RunAttendanceAutomation extends Command
{
    protected $signature = 'alrm:process-automation';

    protected $description = 'Flag overdue pending requests and fire attendance threshold notifications.';

    public function handle(): int
    {
        $lock = Cache::lock('alrm:process-automation', 300);

        if (! $lock->get()) {
            $this->warn('alrm:process-automation is already running — skipping this invocation.');

            return self::SUCCESS;
        }

        try {
            $flagged = $this->flagOverdueRequests();
            $notified = $this->fireThresholdNotifications();

            $this->info("Flagged {$flagged} overdue request(s). Sent {$notified} threshold notification(s).");
        } finally {
            $lock->release();
        }

        return self::SUCCESS;
    }

    /**
     * FOLLOWUP_FLAGS: a request sitting 'pending' past the response window
     * gets escalated to the student's Program Head. This overdue-request
     * rule is independent of the critical consultation flags in the notifier.
     */
    private function flagOverdueRequests(): int
    {
        $windowHours = (int) config('alrm.followup_response_window_hours');

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
                'request_id' => $request->id,
                'flagged_date' => now(),
                'escalated_to' => $programHead->id,
                'status' => 'open',
            ]);

            UserNotification::create([
                'user_id' => $programHead->id,
                'request_id' => $request->id,
                'type' => 'followup_flag',
                'message' => "A {$request->type} request has gone unanswered past the response window.",
                'channel' => 'in_app',
                'date_sent' => now(),
                'is_read' => false,
            ]);

            $flagged++;
        }

        return $flagged;
    }

    /**
     * Notify students, class instructors, and program heads using the same stage
     * timestamps as request decisions so the two paths do not double-send.
     */
    private function fireThresholdNotifications(): int
    {
        $notified = 0;
        $notifier = app(AttendanceThresholdNotifier::class);

        AttendanceTracker::where(function ($query) {
            $query->where(fn ($query) => $query->where('status', 'warning')->whereNull('warning_notified_at'))
                ->orWhere(fn ($query) => $query->where('status', 'critical')->whereNull('critical_notified_at'))
                ->orWhere(fn ($query) => $query->where('status', 'IR')->whereNull('ir_notified_at'));
        })->chunkById(100, function ($trackers) use ($notifier, &$notified) {
            foreach ($trackers as $tracker) {
                if ($notifier->notify($tracker)) {
                    $notified++;
                }
            }
        });

        return $notified;
    }
}
