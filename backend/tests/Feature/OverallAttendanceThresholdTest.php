<?php

namespace Tests\Feature;

use App\Models\AttendanceTracker;
use App\Models\Enrollment;
use App\Models\ExcuseRequest;
use App\Models\UserNotification;
use Tests\SecurityTestCase;

class OverallAttendanceThresholdTest extends SecurityTestCase
{
    public function test_eight_subjects_include_untracked_enrollments_and_keep_subject_ir_separate(): void
    {
        $student = $this->user();
        $fixture = $this->requestFor($student, classAttributes: ['weekly_hours' => 5, 'meetings_per_week' => 2]);
        for ($i = 1; $i < 8; $i++) {
            $class = $fixture->enrollment->class->replicate();
            $class->weekly_hours = 3;
            $class->save();
            Enrollment::create(['student_id' => $student->id, 'class_id' => $class->id, 'year_level' => '1st']);
        }
        $tracker = AttendanceTracker::create([
            'enrollment_id' => $fixture->enrollment_id, 'total_absences' => 3,
            'absence_hours' => 8, 'total_lates' => 0, 'converted_absences' => 3, 'status' => 'safe',
        ]);
        $tracker->recompute();
        $this->assertSame('IR', $tracker->status);
        // 5 + seven 3-hour subjects, all over 16 weeks = 416 hours.
        $this->bearer($student)->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('data.total_classes', 8)
            ->assertJsonPath('data.threshold.total_semester_hours', 416)
            ->assertJsonPath('data.threshold.used', 8)
            ->assertJsonPath('data.threshold.limit', 83.2)
            ->assertJsonPath('data.threshold.absence_percentage', 1.92)
            ->assertJsonPath('data.threshold.remaining_semester_percentage', 18.08)
            ->assertJsonPath('data.threshold.status', 'safe')
            ->assertJsonCount(8, 'data.subject_thresholds');
        $this->bearer($fixture->enrollment->class->instructor)->getJson('/api/instructor/dashboard')->assertOk()
            ->assertJsonPath('data.flagged_students.0.status', 'IR')
            ->assertJsonPath('data.flagged_students.0.absences', 3)
            ->assertJsonPath('data.flagged_students.0.used_hours', 8)
            ->assertJsonPath('data.flagged_students.0.absence_percentage', 10)
            ->assertJsonPath('data.flagged_students.0.ir_absence_limit', 3);
    }

    public function test_hours_are_summed_before_percentages_and_allowance_rounding(): void
    {
        $student = $this->user();
        foreach ([[1, 2, 2], [5, 2, 5]] as [$weekly, $absences, $hours]) {
            $fixture = $this->requestFor($student, classAttributes: ['weekly_hours' => $weekly]);
            $tracker = AttendanceTracker::create([
                'enrollment_id' => $fixture->enrollment_id, 'total_absences' => $absences,
                'absence_hours' => $hours, 'total_lates' => 3, 'status' => 'safe',
            ]);
            $tracker->recompute();
        }
        // 2+1 + 5+1 = 9 missed hours; 96 semester hours; exact allowance 19.2, not 4+16.
        $this->bearer($student)->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('data.threshold.used', 9)
            ->assertJsonPath('data.threshold.limit', 19.2)
            ->assertJsonPath('data.threshold.absence_percentage', 9.38)
            ->assertJsonPath('data.threshold.remaining_hours', 10.2)
            ->assertJsonPath('data.threshold.status', 'warning');
    }

    public function test_twenty_percent_overall_is_independent_of_subject_absence_count(): void
    {
        $student = $this->user();
        $fixture = $this->requestFor($student, classAttributes: ['weekly_hours' => 5]);
        $tracker = AttendanceTracker::create([
            'enrollment_id' => $fixture->enrollment_id, 'total_absences' => 1,
            'absence_hours' => 16, 'total_lates' => 0, 'status' => 'safe',
        ]);
        $tracker->recompute();
        $this->assertSame('critical', $tracker->status);
        $this->bearer($student)->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('data.threshold.absence_percentage', 20)
            ->assertJsonPath('data.threshold.status', 'IR')
            ->assertJsonPath('data.threshold.remaining_hours', 0);
    }

    public function test_enrollments_without_trackers_start_with_full_allowance(): void
    {
        $student = $this->user();
        $this->requestFor($student, classAttributes: ['weekly_hours' => 5]);
        $this->bearer($student)->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('data.threshold.used', 0)
            ->assertJsonPath('data.threshold.limit', 16)
            ->assertJsonPath('data.threshold.remaining_semester_percentage', 20)
            ->assertJsonPath('data.subject_thresholds.0.status', 'safe');
    }

    public function test_no_enrollments_does_not_divide_by_zero(): void
    {
        $this->bearer($this->user())->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('data.threshold.limit', 0)
            ->assertJsonPath('data.threshold.absence_percentage', 0)
            ->assertJsonPath('data.threshold.remaining_semester_percentage', 0)
            ->assertJsonPath('data.threshold.status', 'safe')
            ->assertJsonCount(0, 'data.subject_thresholds');
    }

    public function test_late_conversions_are_hours_and_do_not_trigger_the_three_absence_rule(): void
    {
        $fixture = $this->requestFor($this->user(), classAttributes: ['weekly_hours' => 1]);
        $tracker = AttendanceTracker::create([
            'enrollment_id' => $fixture->enrollment_id, 'total_absences' => 0,
            'absence_hours' => 0, 'total_lates' => 9, 'status' => 'safe',
        ]);
        $tracker->recompute();
        $this->assertSame(3, $tracker->converted_absences);
        $this->assertSame(3.0, $tracker->unitsUsed());
        $this->assertSame('critical', $tracker->status);
        $this->bearer($fixture->enrollment->class->instructor)->getJson('/api/instructor/dashboard')->assertOk()
            ->assertJsonPath('data.flagged_students.0.absences', 0)
            ->assertJsonPath('data.flagged_students.0.converted_absences', 3)
            ->assertJsonPath('data.flagged_students.0.status', 'critical');
    }

    public function test_third_decided_absence_uses_actual_unequal_meeting_hours_and_notifies_once(): void
    {
        $student = $this->user();
        $fixture = $this->requestFor($student, classAttributes: [
            'weekly_hours' => 5, 'meetings_per_week' => 2,
            'schedule' => [
                ['day' => 'Mon', 'start' => '08:00', 'end' => '11:00'],
                ['day' => 'Tue', 'start' => '08:00', 'end' => '10:00'],
            ],
        ]);
        $instructor = $fixture->enrollment->class->instructor;
        foreach ([['2026-10-19', 'approved'], ['2026-10-20', 'noted'], ['2026-10-26', 'invalid']] as [$date, $decision]) {
            $request = $fixture->replicate();
            $request->fill(['start_date_of_absence' => $date, 'end_date_of_absence' => $date]);
            ExcuseRequest::withoutEvents(fn () => $request->save());
            $this->bearer($instructor)->patchJson('/api/instructor/requests/'.$request->id.'/decision', ['status' => $decision])->assertOk();
        }
        $tracker = AttendanceTracker::where('enrollment_id', $fixture->enrollment_id)->firstOrFail();
        $this->assertSame(8.0, $tracker->unitsUsed());
        $this->assertSame(3, $tracker->total_absences);
        $this->assertSame('IR', $tracker->status);
        $this->artisan('alrm:process-automation')->assertSuccessful();
        $this->assertSame(1, UserNotification::where('user_id', $instructor->id)->where('type', 'ir_escalation')->count());
        $this->assertStringContainsString('3 recorded absences; subject IR at 3 absences; 8 missed hours',
            UserNotification::where('user_id', $instructor->id)->where('type', 'ir_escalation')->firstOrFail()->message);
        $this->bearer($student)->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('data.threshold.absence_percentage', 10)
            ->assertJsonPath('data.threshold.status', 'warning')
            ->assertJsonPath('data.subject_thresholds.0.status', 'IR');
        $this->bearer($this->user('instructor'))->getJson('/api/instructor/dashboard')->assertOk()
            ->assertJsonCount(0, 'data.flagged_students');
    }

    public function test_migration_recomputes_existing_statuses_without_resetting_notifications(): void
    {
        $fixture = $this->requestFor($this->user(), classAttributes: ['weekly_hours' => 5]);
        $tracker = AttendanceTracker::create([
            'enrollment_id' => $fixture->enrollment_id, 'total_absences' => 3,
            'absence_hours' => 8, 'total_lates' => 0, 'status' => 'warning',
            'warning_notified_at' => now()->startOfSecond(),
        ]);
        $notifiedAt = $tracker->warning_notified_at->toDateTimeString();
        $migration = require database_path('migrations/2026_11_06_000002_recompute_subject_ir_statuses.php');
        $migration->up();
        $this->assertSame('IR', $tracker->fresh()->status);
        $this->assertSame($notifiedAt, $tracker->fresh()->warning_notified_at->toDateTimeString());
        $this->assertSame(0, UserNotification::count());
        $migration->down();
        $this->assertSame('warning', $tracker->fresh()->status);
    }
}
