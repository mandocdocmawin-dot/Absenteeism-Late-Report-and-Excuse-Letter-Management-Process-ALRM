<?php

namespace Tests\Feature;

use App\Exports\ReportExport;
use App\Models\AuditLog;
use App\Models\ClassModel;
use App\Models\Enrollment;
use App\Models\ExcuseRequest;
use App\Models\Program;
use App\Models\TeachingAssignment;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\SecurityTestCase;

class TeachingAssignmentTest extends SecurityTestCase
{
    private function classroom(?User $instructor = null, string $subject = 'Understanding the Self'): ClassModel
    {
        return ClassModel::create([
            'subject_name' => $subject, 'instructor_id' => $instructor?->id,
            'program_id' => Program::factory()->create()->id, 'year_level' => '1st',
            'section' => 'BSIS 1', 'semester' => '1st', 'school_year' => '2026-2027', 'schedule' => [],
        ]);
    }

    private function change(ClassModel $class, array $input)
    {
        return $this->bearer($this->user('administrator'))->postJson('/api/admin/classes/'.$class->id.'/assignment', [
            'expected_revision' => $class->assignment_revision, 'reason' => 'Teaching load adjustment', ...$input,
        ]);
    }

    public function test_replacement_preserves_history_and_scopes_access_to_the_original_instructor(): void
    {
        $student = $this->user();
        $rhea = $this->user('instructor', ['name' => 'Rhea']);
        $gian = $this->user('instructor', ['name' => 'Gian Carlo']);
        $record = $this->requestFor($student, $rhea);
        $record->update(['status' => 'approved']);
        $class = $record->enrollment->class;
        $oldId = $record->teaching_assignment_id;
        $snapshot = $record->class_snapshot;

        $this->change($class, ['action' => 'change_instructor', 'instructor_id' => $gian->id])->assertOk();
        $this->assertSame($gian->id, $class->fresh()->instructor_id);
        $this->assertNotNull(TeachingAssignment::findOrFail($oldId)->ended_at);
        $this->assertSame($snapshot, $record->fresh()->class_snapshot);
        $this->assertSame($oldId, $record->fresh()->teaching_assignment_id);

        $this->bearer($student)->getJson('/api/requests/'.$record->id)->assertOk()
            ->assertJsonPath('data.enrollment.class.instructor.name', 'Rhea');
        $this->bearer($rhea)->getJson('/api/instructor/requests')->assertOk()->assertJsonCount(1, 'data');
        $this->bearer($rhea)->getJson('/api/requests/'.$record->id.'/evidence')->assertNotFound();
        $this->bearer($gian)->getJson('/api/instructor/requests')->assertOk()->assertJsonCount(0, 'data');
        $this->bearer($gian)->getJson('/api/requests/'.$record->id.'/evidence')->assertForbidden();
        $this->bearer($rhea)->patchJson('/api/instructor/requests/'.$record->id.'/decision', ['status' => 'noted'])->assertForbidden();

        $mapped = (new ReportExport(collect([$record->fresh()])))->map($record->fresh());
        $this->assertSame('Rhea', $mapped[4]);
    }

    public function test_pending_requests_block_all_changes_without_modifying_rows(): void
    {
        $record = $this->requestFor($this->user());
        $class = $record->enrollment->class;
        $other = $this->classroom($this->user('instructor'));
        foreach (['remove', 'change_instructor', 'change_subject', 'swap'] as $action) {
            $this->change($class, [
                'action' => $action, 'instructor_id' => $this->user('instructor')->id,
                'target_class_id' => $action === 'change_subject' ? $this->classroom()->id : $other->id,
                'target_expected_revision' => $action === 'change_subject' ? 0 : $other->assignment_revision,
            ])->assertConflict();
        }
        $this->assertSame(2, TeachingAssignment::count());
        $this->assertSame(0, TeachingAssignment::whereNotNull('ended_at')->count());
        $this->assertSame(0, AuditLog::where('action', 'changed_teaching_assignment')->count());
        $this->bearer($this->user('administrator'))->getJson('/api/admin/classes/'.$class->id.'/pending-requests')
            ->assertOk()->assertJsonPath('data.0.id', $record->id);
    }

    public function test_swap_closes_both_originals_and_logs_one_event_for_both_classes(): void
    {
        $first = $this->requestFor($this->user(), $this->user('instructor', ['name' => 'Rhea']));
        $second = $this->requestFor($this->user(), $this->user('instructor', ['name' => 'Gian Carlo']));
        $first->update(['status' => 'approved']);
        $second->update(['status' => 'invalid']);
        $a = $first->enrollment->class;
        $b = $second->enrollment->class;
        $response = $this->change($a, [
            'action' => 'swap', 'target_class_id' => $b->id, 'target_expected_revision' => $b->assignment_revision,
        ])->assertOk();
        $this->assertSame($b->instructor_id, $a->fresh()->instructor_id);
        $this->assertSame($a->instructor_id, $b->fresh()->instructor_id);
        $this->assertSame(2, TeachingAssignment::whereNotNull('ended_at')->count());
        $this->assertSame(2, TeachingAssignment::whereNull('ended_at')->count());
        $this->assertSame('Rhea', $first->fresh()->class_snapshot['instructor']['name']);
        $this->assertSame('Gian Carlo', $second->fresh()->class_snapshot['instructor']['name']);
        $log = AuditLog::where('action', 'changed_teaching_assignment')->sole();
        $this->assertCount(2, $log->details['before']);
        $this->assertCount(2, $log->details['after']);
        $this->assertSame($response->json('data.event_id'), $log->details['event_id']);
        $this->bearer($this->user('administrator'))->getJson('/api/admin/classes/'.$b->id.'/assignments')
            ->assertOk()->assertJsonPath('data.events.0.details.event_id', $log->details['event_id']);
    }

    public function test_failure_during_second_swap_insert_rolls_everything_back(): void
    {
        $a = $this->classroom($this->user('instructor'));
        $b = $this->classroom($this->user('instructor'));
        $event = 'eloquent.creating: '.TeachingAssignment::class;
        $inserts = 0;
        Event::listen($event, function () use (&$inserts) {
            if (++$inserts === 2) {
                throw new \RuntimeException('Injected failure during second replacement');
            }
        });
        try {
            $this->change($a, ['action' => 'swap', 'target_class_id' => $b->id, 'target_expected_revision' => 1])
                ->assertStatus(500);
        } finally {
            Event::forget($event);
        }
        $this->assertSame($a->instructor_id, $a->fresh()->instructor_id);
        $this->assertSame($b->instructor_id, $b->fresh()->instructor_id);
        $this->assertSame(1, $a->fresh()->assignment_revision);
        $this->assertSame(1, $b->fresh()->assignment_revision);
        $this->assertSame(2, TeachingAssignment::count());
        $this->assertSame(0, TeachingAssignment::whereNotNull('ended_at')->count());
        $this->assertSame(0, AuditLog::where('action', 'changed_teaching_assignment')->count());
    }

    public function test_stale_revision_cannot_apply_a_second_edit_or_create_duplicates(): void
    {
        $class = $this->classroom($this->user('instructor'));
        $this->change($class, ['action' => 'change_instructor', 'instructor_id' => $this->user('instructor')->id])->assertOk();
        $this->change($class, ['action' => 'remove'])->assertConflict();
        $this->assertSame(2, TeachingAssignment::count());
        $this->assertSame(1, TeachingAssignment::whereNull('ended_at')->count());
    }

    public function test_stale_swap_target_does_not_change_source(): void
    {
        $a = $this->classroom($this->user('instructor'));
        $b = $this->classroom($this->user('instructor'));
        $this->change($b, ['action' => 'remove'])->assertOk();
        $this->change($a, ['action' => 'swap', 'target_class_id' => $b->id, 'target_expected_revision' => 1])->assertConflict();
        $this->assertNull($a->activeTeachingAssignment->ended_at);
        $this->assertSame(1, $a->fresh()->assignment_revision);
    }

    public function test_change_subject_leaves_original_class_and_enrollments_in_place(): void
    {
        $record = $this->requestFor($this->user());
        $record->update(['status' => 'approved']);
        $source = $record->enrollment->class;
        $target = $this->classroom(null, 'Organization and Management');
        $this->change($source, ['action' => 'change_subject', 'target_class_id' => $target->id, 'target_expected_revision' => 0])->assertOk();
        $this->assertNull($source->fresh()->instructor_id);
        $this->assertSame($source->instructor_id, $target->fresh()->instructor_id);
        $this->assertSame($source->id, $record->enrollment->fresh()->class_id);
        $this->assertSame('Security', $source->fresh()->subject_name);
        $this->assertSame('Security', $record->fresh()->class_snapshot['subject_name']);
    }

    public function test_remove_hides_class_and_rejects_submission_until_reassigned(): void
    {
        $student = $this->user();
        $fixture = $this->requestFor($student);
        $fixture->update(['status' => 'approved']);
        $class = $fixture->enrollment->class;
        $this->change($class, ['action' => 'remove'])->assertOk();
        $this->assertNull($class->fresh()->instructor_id);
        $this->assertNull($class->fresh()->activeTeachingAssignment);
        $this->bearer($student)->getJson('/api/classes')->assertOk()->assertJsonCount(0, 'data');
        $payload = [
            'class_id' => $class->id, 'type' => 'absence', 'subjects_missed' => 'Spoofed Subject',
            'start_date_of_absence' => '2026-10-29', 'reason' => 'Illness again',
            'guardian_name' => 'Parent Name', 'contact_number' => '09123456789',
            'class_snapshot' => ['subject_name' => 'Spoofed Subject'],
            'evidence_file_url' => $this->unusedEvidence($student)->id,
        ];
        $this->bearer($student)->postJson('/api/requests', $payload)->assertUnprocessable();
        $newInstructor = $this->user('instructor', ['name' => 'Replacement']);
        $this->change($class->fresh(), ['action' => 'assign', 'instructor_id' => $newInstructor->id])->assertOk();
        $response = $this->bearer($student)->postJson('/api/requests', $payload)->assertCreated()
            ->assertJsonPath('data.class_snapshot.subject_name', 'Security')
            ->assertJsonPath('data.class_snapshot.instructor.name', 'Replacement')
            ->assertJsonPath('data.snapshot_source', 'submission');
        $this->assertNotSame($fixture->teaching_assignment_id, $response->json('data.teaching_assignment_id'));
    }

    public function test_class_edit_and_delete_cannot_bypass_assignment_safeguards(): void
    {
        $class = $this->classroom($this->user('instructor'));
        $this->bearer($this->user('administrator'))->patchJson('/api/admin/classes/'.$class->id, ['instructor_id' => null])
            ->assertUnprocessable();
        $this->bearer($this->user('administrator'))->patchJson('/api/admin/classes/'.$class->id, ['subject_name' => 'Different subject'])
            ->assertConflict();
        $this->bearer($this->user('administrator'))->deleteJson('/api/admin/classes/'.$class->id)->assertConflict();
        $this->assertSame('Understanding the Self', $class->fresh()->subject_name);
    }

    public function test_assignment_endpoint_requires_admin_and_complete_concurrency_tokens(): void
    {
        $class = $this->classroom($this->user('instructor'));
        $url = '/api/admin/classes/'.$class->id.'/assignment';
        $this->postJson($url, [])->assertUnauthorized();
        $this->bearer($this->user('instructor'))->postJson($url, [])->assertForbidden();
        $this->bearer($this->user('administrator'))->postJson($url, ['action' => 'remove'])->assertUnprocessable()
            ->assertJsonValidationErrors(['expected_revision', 'reason']);
    }

    public function test_occupied_destination_same_class_and_invalid_instructor_are_rejected(): void
    {
        $a = $this->classroom($this->user('instructor'));
        $b = $this->classroom($this->user('instructor'));
        $this->change($a, ['action' => 'change_subject', 'target_class_id' => $b->id, 'target_expected_revision' => 1])->assertConflict();
        $this->change($a, ['action' => 'swap', 'target_class_id' => $a->id, 'target_expected_revision' => 1])->assertUnprocessable();
        $this->change($a, ['action' => 'change_instructor', 'instructor_id' => $this->user()->id])->assertUnprocessable();
        $this->change($a, ['action' => 'change_instructor', 'instructor_id' => $this->user('instructor', ['status' => 'deactivated'])->id])->assertUnprocessable();
        $this->assertSame(2, TeachingAssignment::count());
    }

    public function test_database_rejects_duplicate_active_assignment(): void
    {
        $class = $this->classroom($this->user('instructor'));
        $this->expectException(QueryException::class);
        TeachingAssignment::create([
            'class_id' => $class->id, 'instructor_id' => $this->user('instructor')->id, 'version' => 2, 'started_at' => now(),
        ]);
    }

    public function test_database_restricts_deleting_an_assignment_referenced_by_a_request(): void
    {
        $record = $this->requestFor($this->user());
        $this->expectException(QueryException::class);
        DB::table('teaching_assignments')->where('id', $record->teaching_assignment_id)->delete();
    }

    public function test_database_restricts_deleting_a_request_enrollment(): void
    {
        $record = $this->requestFor($this->user());
        $this->expectException(QueryException::class);
        Enrollment::whereKey($record->enrollment_id)->delete();
    }

    public function test_snapshot_cannot_be_changed_after_submission(): void
    {
        $record = $this->requestFor($this->user());
        $this->expectException(\LogicException::class);
        $record->forceFill(['class_snapshot' => ['subject_name' => 'Changed']])->save();
    }

    public function test_submission_with_an_ended_assignment_token_is_rejected(): void
    {
        $student = $this->user();
        $fixture = $this->requestFor($student);
        $fixture->update(['status' => 'approved']);
        $class = $fixture->enrollment->class;
        $this->change($class, ['action' => 'change_instructor', 'instructor_id' => $this->user('instructor')->id])->assertOk();
        $this->bearer($student)->postJson('/api/requests', [
            'class_id' => $class->id, 'teaching_assignment_id' => $fixture->teaching_assignment_id,
            'evidence_file_url' => $this->unusedEvidence($student)->id,
            'type' => 'absence', 'subjects_missed' => 'Security', 'reason' => 'New reason',
            'start_date_of_absence' => '2026-10-30', 'guardian_name' => 'Parent Name', 'contact_number' => '09123456789',
        ])->assertConflict();
        $this->assertSame(1, ExcuseRequest::count());
    }

    public function test_class_and_user_renames_do_not_change_snapshot_or_export(): void
    {
        $record = $this->requestFor($this->user(), $this->user('instructor', ['name' => 'Rhea']));
        $class = $record->enrollment->class;
        $programName = $record->class_snapshot['program']['program_name'];
        $class->instructor->update(['name' => 'Renamed Instructor']);
        $class->program->update(['program_name' => 'Renamed Program']);
        // Simulate an internal import, which must not rewrite a submitted snapshot.
        $class->update(['subject_name' => 'Renamed Subject', 'section' => 'New Section']);
        $record = $record->fresh()->load('enrollment.class');
        $this->assertSame('Security', $record->toArray()['enrollment']['class']['subject_name']);
        $mapped = (new ReportExport(collect([$record])))->map($record);
        $this->assertSame($programName, $mapped[2]);
        $this->assertSame('Security', $mapped[3]);
        $this->assertSame('Rhea', $mapped[4]);
    }

    public function test_migration_backfills_legacy_rows_and_marks_their_provenance(): void
    {
        $record = $this->requestFor($this->user());
        $classId = $record->enrollment->class_id;
        $unassigned = $this->requestFor($this->user());
        $unassignedClass = $unassigned->enrollment->class_id;
        $migration = require database_path('migrations/2026_10_30_000001_version_teaching_assignments.php');
        $migration->down();
        DB::table('classes')->where('id', $classId)->update(['subject_name' => 'Current legacy subject']);
        DB::table('classes')->where('id', $unassignedClass)->update(['instructor_id' => null]);
        $migration->up();

        $legacy = $record->fresh();
        $this->assertSame('legacy_backfill', $legacy->snapshot_source);
        $this->assertSame('Current legacy subject', $legacy->class_snapshot['subject_name']);
        $this->assertNotNull($legacy->teaching_assignment_id);
        $this->assertSame(1, ClassModel::findOrFail($classId)->assignment_revision);
        $this->assertSame('legacy_backfill', $unassigned->fresh()->snapshot_source);
        $this->assertNull($unassigned->fresh()->teaching_assignment_id);
        $this->assertNull($unassigned->fresh()->class_snapshot['instructor']);
    }
}
