<?php

namespace Tests\Feature;

use App\Models\AttendanceTracker;
use App\Models\FollowupFlag;
use App\Models\UserNotification;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\SecurityTestCase;

class AttendanceThresholdPolicyTest extends SecurityTestCase
{
    public static function decisionCases(): array
    {
        return [
            ['absence', 'approved', 1, 0],
            ['absence', 'noted', 1, 0],
            ['absence', 'invalid', 1, 0],
            ['late', 'approved', 0, 0],
            ['late', 'noted', 0, 0],
            ['late', 'invalid', 0, 1],
        ];
    }

    #[DataProvider('decisionCases')]
    public function test_decisions_count_all_absences_but_only_invalid_lates(string $type, string $status, int $absences, int $lates): void
    {
        $request = $this->requestFor($this->user());
        $request->update(['type' => $type]);
        $endpoint = '/api/instructor/requests/'.$request->id.'/decision';
        $this->assertFalse(AttendanceTracker::where('enrollment_id', $request->enrollment_id)->exists());

        $this->bearer($request->enrollment->class->instructor)->patchJson($endpoint, ['status' => $status])->assertOk();
        $this->patchJson($endpoint, ['status' => $status])->assertConflict();

        $tracker = AttendanceTracker::where('enrollment_id', $request->enrollment_id)->first();
        $this->assertSame($absences, $tracker?->total_absences ?? 0);
        $this->assertSame($lates, $tracker?->total_lates ?? 0);
        $this->assertSame($absences * 3.0, $tracker?->unitsUsed() ?? 0.0);
        if ($absences > 0) {
            $this->assertSame('warning', $tracker->status);
            $this->assertDatabaseHas('notifications', [
                'request_id' => $request->id, 'type' => 'threshold_warning',
            ]);
        }
        $this->bearer($request->enrollment->student)->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('data.unexcused_absences', $type === 'absence' && $status === 'invalid' ? 1 : 0)
            ->assertJsonPath('data.excused_absences', $type === 'absence' && $status !== 'invalid' ? 1 : 0);
    }

    #[TestWith(['approved', 2, 0])]
    #[TestWith(['noted', 2, 0])]
    #[TestWith(['invalid', 3, 1])]
    public function test_only_an_invalid_third_late_converts_to_an_absence(string $status, int $lates, int $converted): void
    {
        $request = $this->requestFor($this->user());
        $request->update(['type' => 'late']);
        $tracker = AttendanceTracker::create([
            'enrollment_id' => $request->enrollment_id, 'total_lates' => 2,
            'total_absences' => 0, 'converted_absences' => 0, 'status' => 'safe',
        ]);

        $this->bearer($request->enrollment->class->instructor)
            ->patchJson('/api/instructor/requests/'.$request->id.'/decision', ['status' => $status])->assertOk();

        $tracker->refresh();
        $this->assertSame($lates, $tracker->total_lates);
        $this->assertSame($converted, $tracker->converted_absences);
        $this->assertSame((float) $converted, $tracker->unitsUsed());
    }

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
            [2, 7.0, [1 => 'safe', 2 => 'warning', 3 => 'warning', 4 => 'critical', 6 => 'critical', 7 => 'IR'], [6 => 3.13, 7 => 0.0]],
            [1, 4.0, [0 => 'safe', 1 => 'warning', 2 => 'critical', 3 => 'critical', 4 => 'IR'], []],
            [4, 13.0, [3 => 'safe', 4 => 'warning', 8 => 'critical', 12 => 'critical', 13 => 'IR'], []],
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

    public function test_drop_limit_waits_for_the_rounded_whole_hour_with_fractional_absences(): void
    {
        $request = $this->requestFor($this->user());
        $request->enrollment->class->update(['weekly_hours' => 2, 'meetings_per_week' => 1]);
        $tracker = AttendanceTracker::create([
            'enrollment_id' => $request->enrollment_id,
            'total_lates' => 0, 'total_absences' => 1,
            'converted_absences' => 0, 'status' => 'safe',
        ]);

        foreach ([
            [6.4, 'critical', 1.88],
            [6.99, 'critical', 0.03],
            [7.0, 'IR', 0.0],
            [7.5, 'IR', 0.0],
        ] as [$hours, $status, $remainingPercentage]) {
            $tracker->absence_hours = $hours;
            $tracker->recompute();

            $this->assertSame(7.0, $tracker->allowedUnits());
            $this->assertSame($status, $tracker->fresh()->status);
            $this->assertSame($remainingPercentage, $tracker->remainingSemesterPercentage());
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

    #[TestWith(['invalid'])]
    #[TestWith(['approved'])]
    #[TestWith(['noted'])]
    public function test_automation_creates_a_critical_consultation_flag_once_even_when_warning_was_skipped(string $status): void
    {
        $request = $this->requestFor($this->user());
        $request->update(['status' => $status, 'date_reviewed' => now()]);
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

    public function test_critical_and_ir_notification_timestamps_are_stored_independently(): void
    {
        $request = $this->requestFor($this->user());
        $tracker = AttendanceTracker::create([
            'enrollment_id' => $request->enrollment_id, 'total_absences' => 4,
            'total_lates' => 0, 'converted_absences' => 4, 'status' => 'critical',
            'critical_notified_at' => now()->startOfSecond(),
        ]);
        $deliveredAt = $tracker->critical_notified_at->toDateTimeString();

        $tracker->refresh();
        $this->assertSame('critical', $tracker->status);
        $this->assertSame($deliveredAt, $tracker->critical_notified_at->toDateTimeString());
        $this->assertNull($tracker->ir_notified_at);
        $tracker->recompute();
        $this->assertSame('IR', $tracker->status);
        $this->assertSame($deliveredAt, $tracker->fresh()->critical_notified_at->toDateTimeString());
    }
}
