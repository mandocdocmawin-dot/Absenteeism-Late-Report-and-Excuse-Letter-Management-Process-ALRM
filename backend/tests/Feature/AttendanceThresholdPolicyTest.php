<?php

namespace Tests\Feature;

use App\Models\AttendanceTracker;
use App\Models\FollowupFlag;
use App\Models\UserNotification;
use Tests\SecurityTestCase;

class AttendanceThresholdPolicyTest extends SecurityTestCase
{
    public function test_subject_hours_determine_all_three_stages_and_remaining_percentages(): void
    {
        $request = $this->requestFor($this->user());
        $tracker = AttendanceTracker::create([
            'enrollment_id' => $request->enrollment_id, 'total_lates' => 0,
            'total_absences' => 0, 'converted_absences' => 0, 'status' => 'safe',
        ]);

        foreach ([
            [3, 10.0, [2 => 'safe', 3 => 'warning', 5 => 'warning', 6 => 'critical', 9 => 'critical', 10 => 'IR', 11 => 'IR'], [3 => 14.58, 6 => 8.33, 10 => 0.0]],
            [5, 16.0, [4 => 'safe', 5 => 'warning', 9 => 'warning', 10 => 'critical', 15 => 'critical', 16 => 'IR', 17 => 'IR'], [5 => 13.75, 10 => 7.5, 16 => 0.0]],
            [2, 6.4, [1 => 'safe', 2 => 'warning', 3 => 'warning', 4 => 'critical', 6 => 'critical', 7 => 'IR'], []],
        ] as [$weeklyHours, $limit, $boundaries, $remaining]) {
            // One-hour meetings let us exercise exact unit boundaries.
            $tracker->enrollment->class->forceFill(['weekly_hours' => $weeklyHours, 'meetings_per_week' => $weeklyHours])->save();
            $this->assertSame($limit, $tracker->allowedUnits());
            foreach ($boundaries as $absences => $status) {
                $tracker->total_absences = $absences;
                $tracker->recompute();
                $this->assertSame($status, $tracker->fresh()->status, "Weekly hours: {$weeklyHours}, units: {$absences}");
                $this->assertSame((float) $absences, $tracker->unitsUsed());
                if (array_key_exists($absences, $remaining)) {
                    $this->assertSame($remaining[$absences], $tracker->remainingSemesterPercentage());
                }
            }
        }
    }

    public function test_three_lates_add_one_hour_independent_of_meeting_duration(): void
    {
        $request = $this->requestFor($this->user());
        $tracker = AttendanceTracker::create([
            'enrollment_id' => $request->enrollment_id, 'total_lates' => 0,
            'total_absences' => 1, 'converted_absences' => 0, 'status' => 'safe',
        ]);
        // Default class: 3-hour meeting. Late conversion must not add 3 hours.
        foreach ([2 => 3.0, 3 => 4.0, 5 => 4.0, 6 => 5.0, 9 => 6.0] as $lates => $hours) {
            $tracker->total_lates = $lates;
            $tracker->recompute();
            $this->assertSame($hours, $tracker->unitsUsed());
        }
        $this->assertSame('critical', $tracker->status);
    }

    public function test_automation_creates_a_critical_consultation_flag_once_even_when_warning_was_skipped(): void
    {
        $request = $this->requestFor($this->user());
        $request->update(['status' => 'invalid', 'date_reviewed' => now()]);
        $head = $this->user('program_head', ['program_id' => $request->enrollment->class->program_id]);
        $tracker = AttendanceTracker::create([
            'enrollment_id' => $request->enrollment_id, 'total_absences' => 2,
            'total_lates' => 0, 'converted_absences' => 0, 'status' => 'safe',
        ]);
        $tracker->recompute();
        $this->assertSame('critical', $tracker->status);
        $this->assertLessThan($tracker->allowedUnits(), $tracker->unitsUsed());

        $this->artisan('alrm:process-automation')->assertSuccessful();
        $this->artisan('alrm:process-automation')->assertSuccessful();

        $this->assertSame(1, FollowupFlag::where('request_id', $request->id)->count());
        $this->assertDatabaseHas('followup_flags', [
            'request_id' => $request->id, 'escalated_to' => $head->id, 'status' => 'open',
        ]);
        $this->assertSame(1, UserNotification::where('user_id', $head->id)->where('type', 'threshold_critical')->count());
        $this->assertNotNull($tracker->fresh()->critical_notified_at);
        $this->assertNull($tracker->fresh()->ir_notified_at);
    }

    public function test_critical_stage_is_visible_on_dashboards(): void
    {
        $student = $this->user();
        $request = $this->requestFor($student);
        $class = $request->enrollment->class;
        $head = $this->user('program_head', ['program_id' => $class->program_id]);
        $tracker = AttendanceTracker::create([
            'enrollment_id' => $request->enrollment_id, 'total_absences' => 2,
            'total_lates' => 0, 'converted_absences' => 0, 'status' => 'safe',
        ]);
        $tracker->recompute();

        $this->bearer($student)->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('data.threshold.status', 'critical')
            ->assertJsonPath('data.threshold.limit', 10)
            ->assertJsonPath('data.threshold.remaining_semester_percentage', 8.33);
        $this->bearer($class->instructor)->getJson('/api/instructor/dashboard')->assertOk()
            ->assertJsonPath('data.flagged_students.0.status', 'critical');
        $this->bearer($head)->getJson('/api/program-head/dashboard')->assertOk()
            ->assertJsonPath('data.critical_count', 1)->assertJsonPath('data.ir_count', 0);
    }

    public function test_migration_preserves_historical_consultation_delivery_without_suppressing_drop_alert(): void
    {
        $request = $this->requestFor($this->user());
        $tracker = AttendanceTracker::create([
            'enrollment_id' => $request->enrollment_id, 'total_absences' => 4,
            'total_lates' => 0, 'converted_absences' => 4, 'status' => 'IR',
            'ir_notified_at' => now()->startOfSecond(),
        ]);
        $deliveredAt = $tracker->ir_notified_at->toDateTimeString();
        $migration = require database_path('migrations/2026_10_28_120000_add_critical_attendance_stage.php');
        $migration->down();
        $migration->up();

        $tracker->refresh();
        $this->assertSame('critical', $tracker->status);
        $this->assertSame($deliveredAt, $tracker->critical_notified_at->toDateTimeString());
        $this->assertNull($tracker->ir_notified_at);
        $tracker->recompute();
        $this->assertSame('IR', $tracker->status);
    }
}
