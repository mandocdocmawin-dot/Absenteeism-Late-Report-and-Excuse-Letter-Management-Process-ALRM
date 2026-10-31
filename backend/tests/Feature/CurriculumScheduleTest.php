<?php

namespace Tests\Feature;

use App\Models\AttendanceTracker;
use App\Models\ClassModel;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Enrollment;
use App\Models\Program;
use App\Models\ProgramOffering;
use App\Models\User;
use App\Services\AcademicPeriod;
use App\Services\CurriculumCatalog;
use Database\Seeders\AcademicCatalogSeeder;
use Illuminate\Support\Carbon;
use Tests\SecurityTestCase;

class CurriculumScheduleTest extends SecurityTestCase
{
    private function payload(array $overrides = []): array
    {
        return [
            'subject_name' => 'Web Applications', 'section' => 'BSIS 1',
            'program_id' => Program::firstOrCreate(['program_name' => 'Schedule Test Program'])->id, 'year_level' => '1st',
            'semester' => AcademicPeriod::semester(), 'school_year' => AcademicPeriod::schoolYear(),
            ...$overrides,
        ];
    }

    private function snapshot(array $overrides = []): array
    {
        return [
            'version' => '2025-2026', 'sources' => [], 'subjects' => [[
                'year_level' => '1st', 'semester' => AcademicPeriod::semester(),
                'code' => 'CC 1', 'subject_name' => 'Computing', 'credit_units' => 3,
                'source' => ['file' => 'approved-curriculum.pdf', 'page' => 1],
            ]], ...$overrides,
        ];
    }

    public function test_catalog_seed_is_offline_idempotent_and_does_not_create_users_classes_or_enrollments(): void
    {
        $this->seed(AcademicCatalogSeeder::class);
        $ids = CurriculumSubject::pluck('id')->all();
        $this->seed(AcademicCatalogSeeder::class);
        $this->assertSame(10, Curriculum::count());
        $this->assertSame(603, CurriculumSubject::count());
        $this->assertSame(184, ProgramOffering::count());
        $this->assertSame(6, Program::count());
        $this->assertEqualsCanonicalizing($ids, CurriculumSubject::pluck('id')->all());
        $this->assertSame(0, User::count());
        $this->assertSame(0, ClassModel::count());
        $this->assertSame(0, Enrollment::count());
        $this->assertDatabaseHas('curriculum_subjects', ['code' => 'FAR', 'lecture_units' => 4, 'laboratory_units' => 2, 'credit_units' => 6]);
        foreach (Curriculum::all() as $curriculum) {
            $this->assertNotEmpty($curriculum->sources);
            $this->assertGreaterThan(0, $curriculum->subjects()->count());
        }
    }

    public function test_changed_curriculum_creates_a_revision_without_rewriting_existing_class_or_attendance(): void
    {
        $program = Program::factory()->create();
        $catalog = app(CurriculumCatalog::class);
        $snapshot = $this->snapshot();
        $old = $catalog->import($program->id, $snapshot);
        $subject = $old->subjects()->firstOrFail();
        $class = ClassModel::create($this->payload([
            'program_id' => $program->id, 'curriculum_subject_id' => $subject->id,
            'credit_units' => 3, 'weekly_hours' => 5, 'meetings_per_week' => 2, 'schedule' => [],
        ]));
        $snapshot['subjects'][0]['credit_units'] = 4;
        $new = $catalog->import($program->id, $snapshot);
        $this->assertNotSame($old->id, $new->id);
        $this->assertSame(2, Curriculum::count());
        $this->assertSame(3.0, $subject->fresh()->credit_units);
        $this->assertSame($subject->id, $class->fresh()->curriculum_subject_id);
        $this->assertSame(3.0, $class->fresh()->credit_units);
        $this->assertSame(5.0, (float) $class->fresh()->weekly_hours);
    }

    public function test_schedule_sets_contact_hours_and_meeting_count_independently_of_credit_units(): void
    {
        $admin = $this->user('administrator');
        $response = $this->bearer($admin)->postJson('/api/admin/classes', $this->payload([
            'credit_units' => 3,
            'schedule' => [
                ['day' => 'Mon', 'start' => '08:00', 'end' => '10:30', 'room' => 'Lab 1'],
                ['day' => 'Thu', 'start' => '13:00', 'end' => '15:30'],
            ],
        ]))->assertCreated()->assertJsonPath('data.weekly_hours', 5)
            ->assertJsonPath('data.meetings_per_week', 2)->assertJsonPath('data.credit_units', 3);
        $class = ClassModel::findOrFail($response->json('data.id'));
        $enrollment = Enrollment::create(['class_id' => $class->id, 'student_id' => $this->user()->id, 'year_level' => '1st']);
        $tracker = AttendanceTracker::create([
            'enrollment_id' => $enrollment->id, 'total_absences' => 2, 'total_lates' => 0,
            'converted_absences' => 0, 'status' => 'safe',
        ]);
        $tracker->recompute();
        $this->assertSame(2.5, $class->unitsPerMeeting());
        $this->assertSame(5.0, $tracker->unitsUsed());
        $this->assertSame(16.0, $tracker->allowedUnits());
        $this->assertSame('warning', $tracker->status);
    }

    public function test_class_can_be_created_without_schedule_with_confirmed_hours_and_fractional_hours_are_preserved(): void
    {
        $admin = $this->user('administrator');
        $payload = $this->payload(['weekly_hours' => 2.5, 'meetings_per_week' => 1]);
        $response = $this->bearer($admin)->postJson('/api/admin/classes', $payload)
            ->assertCreated()->assertJsonPath('data.schedule', []);
        $this->assertSame(2.5, (float) ClassModel::findOrFail($response->json('data.id'))->weekly_hours);
        $this->bearer($admin)->postJson('/api/admin/classes', $this->payload())
            ->assertUnprocessable()->assertJsonValidationErrors('weekly_hours');
    }

    public function test_bad_overlapping_or_inconsistent_meeting_times_are_rejected(): void
    {
        $admin = $this->user('administrator');
        foreach ([
            [['day' => 'Mon', 'start' => '10:00', 'end' => '09:00']],
            [['day' => 'Mon', 'start' => '09:00', 'end' => '09:00']],
            [['day' => 'Other', 'start' => '09:00', 'end' => '10:00']],
            [['day' => 'Mon', 'start' => '25:00', 'end' => '26:00']],
            [['day' => 'Mon', 'start' => '09:00', 'end' => '11:00'], ['day' => 'Mon', 'start' => '10:00', 'end' => '12:00']],
        ] as $schedule) {
            $this->bearer($admin)->postJson('/api/admin/classes', $this->payload(['schedule' => $schedule]))->assertUnprocessable();
        }
        $this->bearer($admin)->postJson('/api/admin/classes', $this->payload([
            'schedule' => [['day' => 'Mon', 'start' => '09:00', 'end' => '10:00']],
            'weekly_hours' => 3,
        ]))->assertUnprocessable()->assertJsonValidationErrors('schedule');
        $this->assertSame(0, ClassModel::count());
    }

    public function test_linked_curriculum_subject_must_match_program_year_and_semester(): void
    {
        $admin = $this->user('administrator');
        $program = Program::factory()->create();
        $curriculum = app(CurriculumCatalog::class)->import($program->id, $this->snapshot());
        $subject = $curriculum->subjects()->firstOrFail();
        $payload = $this->payload([
            'program_id' => $program->id, 'curriculum_subject_id' => $subject->id,
            'weekly_hours' => 5, 'meetings_per_week' => 2,
        ]);
        $this->bearer($admin)->postJson('/api/admin/classes', $payload)
            ->assertCreated()->assertJsonPath('data.credit_units', 3);
        foreach (['program_id' => Program::factory()->create()->id, 'year_level' => '2nd', 'semester' => AcademicPeriod::semester() === '1st' ? '2nd' : '1st'] as $field => $value) {
            $this->bearer($admin)->postJson('/api/admin/classes', array_replace($payload, [$field => $value]))
                ->assertUnprocessable()->assertJsonValidationErrors('curriculum_subject_id');
        }
    }

    public function test_admin_can_add_new_curriculum_versions_and_duplicate_submissions_are_idempotent(): void
    {
        $admin = $this->user('administrator');
        $payload = ['program_id' => Program::factory()->create()->id, ...$this->snapshot()];
        $id = $this->bearer($admin)->postJson('/api/admin/curricula', $payload)->assertCreated()->json('data.id');
        $this->bearer($admin)->postJson('/api/admin/curricula', $payload)->assertOk()->assertJsonPath('data.id', $id);
        $payload['version'] = '2027-2028';
        $this->bearer($admin)->postJson('/api/admin/curricula', $payload)->assertCreated();
        $this->bearer($admin)->getJson('/api/admin/curricula/'.$id)->assertOk()->assertJsonPath('data.subjects.0.code', 'CC 1');
        $this->assertSame(2, Curriculum::count());
    }

    public function test_non_admins_cannot_manage_curricula_or_schedules(): void
    {
        $payload = $this->payload(['weekly_hours' => 3, 'meetings_per_week' => 1]);
        $this->postJson('/api/admin/classes', $payload)->assertUnauthorized();
        foreach (['student', 'instructor', 'program_head'] as $role) {
            $this->bearer($this->user($role))->postJson('/api/admin/classes', $payload)->assertForbidden();
            $this->getJson('/api/admin/curricula')->assertForbidden();
        }
    }

    public function test_unequal_meetings_use_the_actual_occurrence_day_and_snapshot_missed_hours(): void
    {
        $instructor = $this->user('instructor');
        $request = $this->requestFor($this->user(), $instructor, [
            'weekly_hours' => 3, 'meetings_per_week' => 2,
            'schedule' => [
                ['day' => 'Mon', 'start' => '09:00', 'end' => '11:00'],
                ['day' => 'Thu', 'start' => '13:00', 'end' => '14:00'],
            ],
        ]);
        $class = $request->enrollment->class;
        $this->assertSame(2.0, $class->absenceHoursForPeriod(Carbon::parse('2026-10-19')));
        $this->assertSame(1.0, $class->absenceHoursForPeriod(Carbon::parse('2026-10-22')));
        $this->assertSame(0.0, $class->absenceHoursForPeriod(Carbon::parse('2026-10-20')));
        $this->assertSame(6.0, $class->absenceHoursForPeriod(Carbon::parse('2026-10-19'), Carbon::parse('2026-11-01')));
        $request->update(['start_date_of_absence' => '2026-10-19', 'end_date_of_absence' => null]);
        $this->bearer($instructor)->patchJson('/api/instructor/requests/'.$request->id.'/decision', ['status' => 'invalid'])->assertOk();
        $tracker = AttendanceTracker::where('enrollment_id', $request->enrollment_id)->firstOrFail();
        $this->assertSame(2.0, $tracker->absence_hours);
        $this->assertSame(2.0, $tracker->unitsUsed());
        $class->update(['schedule' => [], 'weekly_hours' => 6, 'meetings_per_week' => 1]);
        $this->assertSame(2.0, $tracker->fresh()->unitsUsed());
    }

    public function test_setting_a_schedule_later_recomputes_existing_thresholds(): void
    {
        $request = $this->requestFor($this->user());
        $tracker = AttendanceTracker::create([
            'enrollment_id' => $request->enrollment_id, 'total_absences' => 2,
            'total_lates' => 0, 'converted_absences' => 0, 'status' => 'safe',
        ]);
        $tracker->recompute();
        $this->assertSame('critical', $tracker->status);
        $class = $request->enrollment->class;
        $this->bearer($this->user('administrator'))->patchJson('/api/admin/classes/'.$class->id, [
            'schedule' => [
                ['day' => 'Mon', 'start' => '08:00', 'end' => '09:30'],
                ['day' => 'Thu', 'start' => '08:00', 'end' => '09:30'],
            ],
        ])->assertOk()->assertJsonPath('data.meetings_per_week', 2);
        $this->assertSame('warning', $tracker->fresh()->status);
    }

    public function test_invalid_curriculum_submission_does_not_leave_partial_rows(): void
    {
        $admin = $this->user('administrator');
        $payload = ['program_id' => Program::factory()->create()->id, ...$this->snapshot()];
        $payload['subjects'][] = $payload['subjects'][0];
        $this->bearer($admin)->postJson('/api/admin/curricula', $payload)->assertUnprocessable()->assertJsonValidationErrors('subjects');
        $this->assertSame(0, Curriculum::count());
        $this->assertSame(0, CurriculumSubject::count());
    }

    public function test_program_with_curriculum_history_cannot_be_deleted(): void
    {
        $program = Program::factory()->create();
        app(CurriculumCatalog::class)->import($program->id, $this->snapshot());
        $this->bearer($this->user('administrator'))->deleteJson('/api/admin/programs/'.$program->id)->assertStatus(409);
        $this->assertDatabaseHas('programs', ['id' => $program->id]);
    }
}
