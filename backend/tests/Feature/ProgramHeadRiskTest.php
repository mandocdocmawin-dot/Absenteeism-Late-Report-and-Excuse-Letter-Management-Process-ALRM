<?php

namespace Tests\Feature;

use App\Models\AttendanceTracker;
use App\Models\FollowupFlag;
use Tests\SecurityTestCase;

class ProgramHeadRiskTest extends SecurityTestCase
{
    public function test_flagged_students_include_backend_threshold_and_semester_percentage_with_pagination(): void
    {
        [$head, $flag, $tracker] = $this->riskCase();
        foreach (['', '?page=1&per_page=10'] as $query) {
            $this->bearer($head)->getJson('/api/program-head/students/flagged'.$query)->assertOk()
                ->assertJsonPath('data.0.id', $flag->id)
                ->assertJsonPath('data.0.threshold', 'critical')
                ->assertJsonPath('data.0.percentage', 14.58)
                ->assertJsonPath('data.0.status', 'open');
        }

        $tracker->update(['total_absences' => 4]);
        $tracker->recompute();
        $this->bearer($head)->getJson('/api/program-head/students/flagged')->assertOk()
            ->assertJsonPath('data.0.threshold', 'IR')
            ->assertJsonPath('data.0.percentage', 27.08);

        $tracker->delete();
        $this->bearer($head)->getJson('/api/program-head/students/flagged')->assertOk()
            ->assertJsonPath('data.0.threshold', null)
            ->assertJsonPath('data.0.percentage', null);
    }

    public function test_zero_semester_hours_do_not_report_a_fabricated_percentage(): void
    {
        [$head, $flag, $tracker] = $this->riskCase();
        $tracker->enrollment->class->forceFill(['weekly_hours' => 0])->save();
        $tracker->recompute();
        $this->bearer($head)->getJson('/api/program-head/students/flagged')->assertOk()
            ->assertJsonPath('data.0.threshold', 'safe')
            ->assertJsonPath('data.0.percentage', null);
    }

    public function test_resolve_updates_only_the_followup_and_logs_the_action(): void
    {
        [$head, $flag, $tracker] = $this->riskCase();
        $url = '/api/program-head/followup-flags/'.$flag->id.'/resolve';
        $this->bearer($head)->patchJson($url)->assertOk()->assertJsonPath('data.status', 'resolved');
        $this->assertSame('critical', $tracker->fresh()->status);
        $this->assertDatabaseHas('audit_log', [
            'record_id' => $flag->id, 'user_id' => $head->id, 'action' => 'resolved_followup_flag',
        ]);
        $this->patchJson($url)->assertConflict();
        $this->assertDatabaseCount('audit_log', 1);
        $this->getJson('/api/program-head/students/flagged?status=open')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/program-head/students/flagged?status=resolved')->assertOk()
            ->assertJsonPath('data.0.threshold', 'critical');
    }

    public function test_unrelated_heads_and_students_cannot_resolve_or_see_another_programs_flag(): void
    {
        [$head, $flag] = $this->riskCase();
        $url = '/api/program-head/followup-flags/'.$flag->id.'/resolve';
        $this->patchJson($url)->assertUnauthorized();
        $other = $this->user('program_head');
        $this->bearer($other)->patchJson($url)->assertForbidden();
        $this->getJson('/api/program-head/students/flagged')->assertOk()->assertJsonCount(0, 'data');
        $this->bearer($this->user())->patchJson($url)->assertForbidden();
        $this->assertSame('open', $flag->fresh()->status);
    }

    public function test_co_heads_can_resolve_flags_in_their_assigned_program(): void
    {
        [$head, $flag] = $this->riskCase();
        $coHead = $this->user('instructor');
        $coHead->additionalHeadedPrograms()->attach($flag->request->enrollment->class->program_id);
        $this->bearer($coHead)->patchJson('/api/program-head/followup-flags/'.$flag->id.'/resolve')
            ->assertOk()->assertJsonPath('data.status', 'resolved');
    }

    private function riskCase(): array
    {
        $request = $this->requestFor($this->user());
        $head = $this->user('program_head', ['program_id' => $request->enrollment->class->program_id]);
        $tracker = AttendanceTracker::create([
            'enrollment_id' => $request->enrollment_id, 'total_absences' => 2,
            'total_lates' => 3, 'converted_absences' => 0, 'status' => 'safe',
        ]);
        $tracker->recompute();
        $flag = FollowupFlag::create([
            'request_id' => $request->id, 'escalated_to' => $head->id,
            'flagged_date' => now(), 'status' => 'open',
        ]);

        return [$head, $flag, $tracker];
    }
}
