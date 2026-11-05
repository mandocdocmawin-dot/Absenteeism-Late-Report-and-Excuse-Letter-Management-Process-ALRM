<?php

namespace Tests\Feature;

use App\Exports\InstructorRequestExport;
use App\Exports\ReportExport;
use App\Models\AcademicTerm;
use App\Models\AttendanceTracker;
use App\Models\FollowupFlag;
use App\Services\AcademicPeriod;
use Illuminate\Support\Facades\Cache;
use Maatwebsite\Excel\Facades\Excel;
use Tests\SecurityTestCase;

class AcademicPeriodFilteringTest extends SecurityTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(now()->setDate(2026, 11, 6)->startOfDay());
        AcademicTerm::create(['semester' => '1st', 'school_year' => '2026-2027', 'starts_on' => today()]);
        AcademicPeriod::flush();
    }

    private function records(): array
    {
        $student = $this->user();
        $instructor = $this->user('instructor');
        $current = $this->requestFor($student, $instructor);
        $program = $current->enrollment->class->program;
        $otherSemester = $this->requestFor($student, $instructor, [
            'program_id' => $program->id, 'semester' => '2nd', 'subject_name' => 'Other semester',
        ]);
        $otherYear = $this->requestFor($student, $instructor, [
            'program_id' => $program->id, 'school_year' => '2025-2026', 'subject_name' => 'Other year',
        ]);
        $head = $this->user('program_head', ['program_id' => $program->id]);
        $program->update(['program_head_id' => $head->id]);
        foreach ([$current, $otherSemester, $otherYear] as $index => $record) {
            AttendanceTracker::create([
                'enrollment_id' => $record->enrollment_id,
                'total_absences' => $index === 0 ? 0 : 5,
                'total_lates' => $index === 0 ? 0 : 3,
                'converted_absences' => $index === 0 ? 0 : 6,
                'status' => $index === 0 ? 'safe' : 'IR',
            ]);
            FollowupFlag::create([
                'request_id' => $record->id, 'escalated_to' => $head->id,
                'flagged_date' => now(), 'status' => 'open',
            ]);
        }

        return [$student, $instructor, $head, $current, $otherSemester, $otherYear];
    }

    public function test_student_attendance_and_classes_default_to_current_period_and_allow_history(): void
    {
        [$student, , , $current, , $otherYear] = $this->records();
        $this->bearer($student);
        foreach (['/api/attendance/summary', '/api/classes'] as $url) {
            $this->getJson($url)->assertOk()->assertJsonCount(1, 'data')
                ->assertJsonPath('data.0.class_id', $current->enrollment->class_id);
            $this->getJson($url.'?semester=1st&school_year=2025-2026')->assertOk()
                ->assertJsonCount(1, 'data')->assertJsonPath('data.0.class_id', $otherYear->enrollment->class_id);
        }
        $this->assertDatabaseCount('enrollments', 3);
        // The existing request history remains accessible across academic periods.
        $this->getJson('/api/requests')->assertOk()->assertJsonCount(3, 'data');
    }

    public function test_all_dashboard_attendance_and_request_metrics_use_the_current_period(): void
    {
        [$student, $instructor, $head] = $this->records();
        $this->bearer($student)->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('data.total_classes', 1)
            ->assertJsonPath('data.pending_requests', 1)
            ->assertJsonPath('data.lates_recorded', 0)
            ->assertJsonPath('data.threshold.status', 'safe');
        $this->bearer($instructor)->getJson('/api/instructor/dashboard')->assertOk()
            ->assertJsonPath('data.total_classes', 1)->assertJsonCount(1, 'data.pending_requests')
            ->assertJsonCount(0, 'data.flagged_students');
        foreach ([[$head, '/api/program-head/dashboard'], [$this->user('administrator'), '/api/admin/dashboard']] as [$user, $url]) {
            $this->bearer($user)->getJson($url)->assertOk()
                ->assertJsonPath('data.total_classes', 1)->assertJsonPath('data.pending_requests', 1)
                ->assertJsonPath('data.ir_count', 0)->assertJsonCount(1, 'data.recent_flags');
        }
    }

    public function test_admin_preview_and_export_share_period_filters_and_keep_date_filters(): void
    {
        [, , , , , $otherYear] = $this->records();
        $this->bearer($this->user('administrator'));
        $this->getJson('/api/admin/reports/preview')->assertOk()->assertJsonPath('data.row_count', 1);
        $history = '?semester=1st&school_year=2025-2026';
        $this->getJson('/api/admin/reports/preview'.$history)->assertOk()->assertJsonPath('data.row_count', 1);
        $this->getJson('/api/admin/reports/preview'.$history.'&date_from=2026-11-01&date_to=2026-11-06')
            ->assertOk()->assertJsonPath('data.row_count', 0);
        Excel::fake();
        Cache::flush();
        $this->getJson('/api/admin/reports/export'.$history)->assertOk();
        Excel::assertDownloaded('alrm_requests_export_'.now()->format('Y-m-d_His').'.xlsx',
            fn (ReportExport $export) => $export->collection()->modelKeys() === [$otherYear->id]);
    }

    public function test_instructor_exports_default_to_current_period_and_allow_authorized_history(): void
    {
        [, $instructor, , $current, , $otherYear] = $this->records();
        $this->requestFor($this->user(), null, ['school_year' => '2025-2026']);
        $this->bearer($instructor);
        $filename = 'instructor-class-requests-'.now()->format('Y-m-d_His').'.xlsx';
        foreach (['' => $current, '?semester=1st&school_year=2025-2026' => $otherYear] as $query => $record) {
            Excel::fake();
            $this->getJson('/api/instructor/requests/export'.$query)->assertOk();
            Excel::assertDownloaded($filename,
                fn (InstructorRequestExport $export) => $export->collection()->modelKeys() === [$record->id]);
        }
    }

    public function test_head_monitoring_lists_support_current_and_historical_periods(): void
    {
        [, , $head, $current, , $otherYear] = $this->records();
        $this->bearer($head);
        foreach (['/api/program-head/requests', '/api/program-head/students/flagged'] as $url) {
            $this->getJson($url)->assertOk()->assertJsonCount(1, 'data');
            $this->getJson($url.'?semester=1st&school_year=2025-2026')->assertOk()->assertJsonCount(1, 'data');
            $this->getJson($url.'?semester=2nd&school_year=2024-2025')->assertOk()->assertJsonCount(0, 'data');
        }
        $this->getJson('/api/program-head/requests')->assertJsonPath('data.0.id', $current->id);
        $this->getJson('/api/program-head/requests?semester=1st&school_year=2025-2026')
            ->assertJsonPath('data.0.id', $otherYear->id);
    }

    public function test_head_activity_and_risk_exports_filter_period_without_broadening_program_access(): void
    {
        [, , $head] = $this->records();
        $this->requestFor($this->user(), null, ['subject_name' => 'Private class', 'school_year' => '2025-2026']);
        $this->bearer($head);
        foreach (['activity', 'risk'] as $type) {
            Cache::flush();
            $url = '/api/program-head/reports/export?report_type='.$type;
            $current = $this->getJson($url)->assertOk()->streamedContent();
            $this->assertStringContainsString('Security', $current);
            $this->assertStringNotContainsString('Other semester', $current);
            $this->assertStringNotContainsString('Other year', $current);
            $history = $this->getJson($url.'&semester=1st&school_year=2025-2026')->assertOk()->streamedContent();
            $this->assertStringContainsString('Other year', $history);
            $this->assertStringNotContainsString('Security', $history);
            $this->assertStringNotContainsString('Private class', $history);
        }
    }

    public function test_period_filters_are_validated_as_a_complete_pair(): void
    {
        [, $instructor, $head] = $this->records();
        foreach ([
            [$this->user('administrator'), '/api/admin/reports/preview'],
            [$instructor, '/api/instructor/requests/export'],
            [$head, '/api/program-head/reports/export'],
            [$this->user(), '/api/attendance/summary'],
        ] as [$user, $url]) {
            $this->bearer($user);
            foreach (['semester=1st', 'school_year=2025-2026', 'semester=summer&school_year=2025-2026',
                'semester=1st&school_year=2025-2027', 'semester=1st&school_year=2025%2F2026'] as $query) {
                Cache::flush();
                $this->getJson($url.'?'.$query)->assertUnprocessable();
            }
        }
    }

    public function test_changing_saved_period_switches_results_without_rewriting_enrollments(): void
    {
        [$student, , , , $otherSemester] = $this->records();
        $this->bearer($this->user('administrator'))
            ->putJson('/api/admin/academic-period', ['semester' => '2nd', 'school_year' => '2026-2027'])->assertOk();
        $this->bearer($student)->getJson('/api/attendance/summary')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.class_id', $otherSemester->enrollment->class_id);
        $this->getJson('/api/dashboard')->assertOk()->assertJsonPath('data.threshold.status', 'IR');
        $this->assertDatabaseCount('enrollments', 3);
    }
}
