<?php

use App\Models\AttendanceTracker;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Update derived statuses without sending alerts or resetting delivery timestamps.
        AttendanceTracker::with('enrollment.class')->each(function (AttendanceTracker $tracker) {
            if ($tracker->enrollment?->class) {
                $tracker->recompute();
            }
        });
    }

    public function down(): void
    {
        AttendanceTracker::with('enrollment.class')->each(function (AttendanceTracker $tracker) {
            $class = $tracker->enrollment?->class;
            if (! $class) {
                return;
            }
            $used = $tracker->unitsUsed();
            $tracker->status = match (true) {
                $class->totalSemesterHours() <= 0 => 'safe',
                $used >= $class->allowedAbsenceUnits() => 'IR',
                $used >= $class->criticalAbsenceUnits() => 'critical',
                $used >= $class->preventiveAbsenceUnits() => 'warning',
                default => 'safe',
            };
            $tracker->save();
        });
    }
};
