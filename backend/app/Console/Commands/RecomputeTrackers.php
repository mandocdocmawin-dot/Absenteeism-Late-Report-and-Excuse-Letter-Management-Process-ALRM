<?php

namespace App\Console\Commands;

use App\Models\AttendanceTracker;
use Illuminate\Console\Command;

class RecomputeTrackers extends Command
{
    protected $signature = 'alrm:recompute-trackers {--reset-notified : I-reset ang notified timestamps}';

    protected $description = 'Recompute converted_absences and status ng lahat ng attendance tracker.';

    public function handle(): int
    {
        $count = 0;

        AttendanceTracker::with('enrollment.class')->each(function (AttendanceTracker $tracker) use (&$count) {
            if (! $tracker->enrollment?->class) {
                $this->warn("Skipped tracker #{$tracker->id}: walang class.");
                return;
            }

            $tracker->recompute();

            if ($this->option('reset-notified')) {
                $tracker->forceFill([
                    'warning_notified_at' => null,
                    'critical_notified_at' => null,
                    'ir_notified_at'      => null,
                ])->save();
            }

            $count++;
        });

        $this->info("Recomputed {$count} tracker(s).");

        return self::SUCCESS;
    }
}
