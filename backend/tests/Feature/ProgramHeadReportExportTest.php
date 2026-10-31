<?php

namespace Tests\Feature;

use App\Models\AttendanceTracker;
use App\Models\FollowupFlag;
use App\Models\Program;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\SecurityTestCase;

class ProgramHeadReportExportTest extends SecurityTestCase
{
    private const URL = '/api/program-head/reports/export';

    public function test_only_active_assigned_heads_can_export(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        foreach (['student', 'instructor', 'administrator', 'program_head'] as $role) {
            $this->bearer($this->user($role, ['program_id' => null]))->getJson(self::URL)->assertForbidden();
        }
        $head = $this->user('program_head', ['status' => 'deactivated']);
        Program::factory()->create(['program_head_id' => $head->id]);
        $this->bearer($head)->getJson(self::URL)->assertForbidden();
    }

    public function test_activity_csv_is_scoped_and_escapes_formulas_quotes_and_multiline_names(): void
    {
        $head = $this->user('program_head');
        $own = $this->requestFor($this->user('student', ['name' => " \t=SUM(1,2)\n\"Test\""]), null, ['subject_name' => '@SUM(1,2)']);
        $own->enrollment->class->program->update(['program_head_id' => $head->id]);
        $this->requestFor($this->user('student', ['name' => 'Private student']));

        $response = $this->bearer($head)->getJson(self::URL)->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8')
            ->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertStringContainsString('.csv', $response->headers->get('Content-Disposition'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $rows = $this->csv($response);
        $this->assertCount(2, $rows);
        $this->assertSame(['Student', 'Class', 'Submitted', 'Type'], $rows[0]);
        $this->assertSame("' \t=SUM(1,2)\n\"Test\"", $rows[1][0]);
        $this->assertSame("'@SUM(1,2)", $rows[1][1]);
        $this->assertCount(4, $rows[1]);
        $this->assertStringNotContainsString('Illness', json_encode($rows));
    }

    public function test_activity_dates_are_inclusive_use_submission_time_and_fall_back_to_creation(): void
    {
        $head = $this->user('program_head');
        $own = $this->requestFor($this->user());
        $own->enrollment->class->program->update(['program_head_id' => $head->id]);
        $own->update(['date_submitted' => '2026-10-26 23:59:59', 'start_date_of_absence' => '2026-09-01']);
        $this->assertCount(2, $this->csv($this->bearer($head)->getJson(self::URL.'?date_from=2026-10-26&date_to=2026-10-26')->assertOk()));
        $own->forceFill(['date_submitted' => null, 'created_at' => '2026-10-26 00:00:00'])->save();
        $rows = $this->csv($this->bearer($head)->getJson(self::URL.'?date_from=2026-10-26&date_to=2026-10-26')->assertOk());
        $this->assertSame('2026-10-26', $rows[1][2]);
        $own->forceFill(['created_at' => '2026-10-27 00:00:00'])->save();
        $this->assertCount(1, $this->csv($this->bearer($head)->getJson(self::URL.'?date_from=2026-10-26&date_to=2026-10-26')->assertOk()));
    }

    public function test_risk_report_uses_flag_dates_and_excludes_other_programs_even_when_escalated_to_the_caller(): void
    {
        $head = $this->user('program_head');
        $own = $this->requestFor($this->user('student', ['name' => 'Own student']));
        $own->enrollment->class->program->update(['program_head_id' => $head->id]);
        $foreign = $this->requestFor($this->user('student', ['name' => 'Foreign student']));
        $tracker = AttendanceTracker::create([
            'enrollment_id' => $own->enrollment_id, 'total_absences' => 2,
            'total_lates' => 3, 'converted_absences' => 0, 'status' => 'safe',
        ]);
        $tracker->recompute();
        foreach ([$own, $foreign] as $request) {
            FollowupFlag::create([
                'request_id' => $request->id, 'escalated_to' => $head->id,
                'flagged_date' => '2026-10-23 23:59:59', 'status' => 'resolved',
            ]);
        }
        $rows = $this->csv($this->bearer($head)->getJson(self::URL.'?report_type=risk&date_from=2026-10-23&date_to=2026-10-23')->assertOk());
        $this->assertCount(2, $rows);
        $this->assertSame(['Student', 'Class', 'Flagged date', 'Threshold', 'Percentage'], $rows[0]);
        $this->assertSame(['Own student', 'Security', '2026-10-23', 'critical', '14.58'], $rows[1]);
        $this->assertCount(1, $this->csv($this->bearer($head)->getJson(self::URL.'?report_type=risk&date_from=2026-10-24&date_to=2026-10-24')->assertOk()));
    }

    public function test_risk_report_leaves_missing_attendance_data_blank(): void
    {
        $head = $this->user('program_head');
        $request = $this->requestFor($this->user());
        $request->enrollment->class->program->update(['program_head_id' => $head->id]);
        FollowupFlag::create([
            'request_id' => $request->id, 'escalated_to' => $head->id,
            'flagged_date' => now(), 'status' => 'open',
        ]);
        $rows = $this->csv($this->bearer($head)->getJson(self::URL.'?report_type=risk')->assertOk());
        $this->assertSame(['', ''], array_slice($rows[1], 3));
    }

    public function test_co_head_and_current_program_assignments_are_respected_and_program_filter_narrows_results(): void
    {
        $head = $this->user('program_head');
        $first = $this->requestFor($this->user());
        $second = $this->requestFor($this->user());
        $head->update(['program_id' => $first->enrollment->class->program_id]);
        $head->additionalHeadedPrograms()->attach($second->enrollment->class->program_id);
        $this->assertCount(3, $this->csv($this->bearer($head)->getJson(self::URL)->assertOk()));
        $rows = $this->csv($this->bearer($head)->getJson(self::URL.'?program_id='.$second->enrollment->class->program_id)->assertOk());
        $this->assertCount(2, $rows);

        $dualRoleHead = $this->user('instructor');
        $dualRoleHead->additionalHeadedPrograms()->attach($second->enrollment->class->program_id);
        $this->assertCount(2, $this->csv($this->bearer($dualRoleHead)->getJson(self::URL)->assertOk()));
    }

    public function test_invalid_ranges_and_unassigned_program_filters_are_rejected(): void
    {
        $program = Program::factory()->create();
        foreach ([
            ['report_type' => 'unknown'], ['date_from' => 'invalid'],
            ['date_to' => '2026-02-30'], ['date_from' => '2026-10-26', 'date_to' => '2026-10-25'],
            ['date_from' => '2020-01-01', 'date_to' => '2026-10-26'],
            ['date_from' => now()->addDay()->toDateString()],
            ['program_id' => Program::factory()->create()->id],
        ] as $filters) {
            $head = $this->user('program_head', ['program_id' => $program->id]);
            $this->bearer($head)->getJson(self::URL.'?'.http_build_query($filters))->assertUnprocessable();
        }
    }

    public function test_large_exports_are_rejected_without_truncation(): void
    {
        $head = $this->user('program_head');
        $own = $this->requestFor($this->user());
        $own->enrollment->class->program->update(['program_head_id' => $head->id]);
        $rows = [];
        for ($i = 0; $i < 5001; $i++) {
            $rows[] = [
                'id' => (string) Str::uuid(), 'request_id' => $own->id, 'escalated_to' => $head->id,
                'flagged_date' => now(), 'status' => 'open', 'created_at' => now(), 'updated_at' => now(),
            ];
        }
        foreach (array_chunk($rows, 100) as $chunk) {
            DB::table('followup_flags')->insert($chunk);
        }
        $this->bearer($head)->getJson(self::URL.'?report_type=risk')->assertUnprocessable()
            ->assertJsonPath('message', 'Export exceeds the 5000-row limit. Narrow the program or date range.');
    }

    public function test_export_throttle_is_per_user(): void
    {
        $head = $this->user('program_head');
        Program::factory()->create(['program_head_id' => $head->id]);
        for ($i = 0; $i < 3; $i++) {
            $this->bearer($head)->getJson(self::URL)->assertOk();
        }
        $this->bearer($head)->getJson(self::URL)->assertStatus(429);
        $other = $this->user('program_head');
        Program::factory()->create(['program_head_id' => $other->id]);
        $this->bearer($other)->getJson(self::URL)->assertOk();
    }

    private function csv(TestResponse $response): array
    {
        $content = $response->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $content);
        $stream = fopen('php://memory', 'w+b');
        fwrite($stream, substr($content, 3));
        rewind($stream);
        $rows = [];
        while (($row = fgetcsv($stream, escape: '')) !== false) {
            $rows[] = $row;
        }
        fclose($stream);

        return $rows;
    }
}
