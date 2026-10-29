<?php

namespace App\Services;

use App\Models\ClassModel;
use App\Models\ExcuseRequest;
use App\Models\TeachingAssignment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TeachingAssignmentService
{
    public function __construct(private AuditLoggerService $auditLogger) {}

    /** All mutations and submissions lock the class first. Class IDs are sorted for swaps. */
    public function change(string $classId, array $input): array
    {
        return DB::transaction(function () use ($classId, $input) {
            $action = $input['action'];
            $ids = [$classId];
            if (in_array($action, ['change_subject', 'swap'], true)) {
                $ids[] = $input['target_class_id'];
            }
            $classes = ClassModel::whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $class = $classes->get($classId);
            abort_unless($class, 404);
            $this->checkRevision($class, (int) $input['expected_revision']);
            $target = count($ids) === 2 ? $classes->get($input['target_class_id']) : null;
            if (count($ids) === 2) {
                abort_unless($target, 404);
                abort_if($target->id === $class->id, 422, 'Choose a different class.');
                $this->checkRevision($target, (int) $input['target_expected_revision']);
                abort_if($class->semester !== $target->semester || $class->school_year !== $target->school_year,
                    422, 'Both classes must belong to the same academic term.');
            }

            $active = TeachingAssignment::whereIn('class_id', $ids)->whereNull('ended_at')
                ->orderBy('class_id')->lockForUpdate()->get()->keyBy('class_id');
            $old = $active->get($class->id);
            $other = $target ? $active->get($target->id) : null;
            if ($action !== 'assign') {
                abort_unless($old, 409, 'This class has no active assignment. Refresh the list.');
            }
            if ($action === 'assign') {
                abort_if($old, 409, 'This class is already assigned. Use change_instructor or swap.');
            }
            if ($action === 'change_subject') {
                abort_if($other, 409, 'The destination class is already assigned. Use swap instead.');
            }
            if ($action === 'swap') {
                abort_unless($other, 409, 'Both classes must have active assignments to swap.');
                abort_if($old->instructor_id === $other->instructor_id, 422, 'Both classes already have the same instructor.');
            }

            // Include legacy unassigned requests too, rather than silently orphaning pending work.
            $pending = ExcuseRequest::where('status', 'pending')
                ->whereHas('enrollment', fn ($query) => $query->whereIn('class_id', $ids))->count();
            abort_if($pending > 0, 409, "Cannot change assignment: {$pending} pending request(s) must be resolved first.");

            $instructorId = match ($action) {
                'assign', 'change_instructor' => $input['instructor_id'],
                'swap' => $other->instructor_id,
                default => null,
            };
            $instructorIds = array_values(array_filter([$instructorId, $target ? $old?->instructor_id : null]));
            // Lock recipients so concurrent role/status/deletion changes cannot invalidate a new assignment.
            $instructors = User::whereIn('id', $instructorIds)->orderBy('id')->lockForUpdate()->get();
            foreach ($instructorIds as $id) {
                $user = $instructors->firstWhere('id', $id);
                abort_unless($user && $user->role === 'instructor' && $user->canLogin(),
                    422, 'Select an approved instructor.');
            }
            abort_if($action === 'change_instructor' && $instructorId === $old->instructor_id,
                422, 'Choose a different instructor.');

            $before = $active->values()->map(fn ($assignment) => $this->describe($assignment, $classes[$assignment->class_id]))->all();
            // End BOTH originals before inserting either replacement (unique active-class constraint).
            foreach ($active as $assignment) {
                $assignment->update(['ended_at' => now()]);
            }
            $class->assignment_revision++;
            $class->instructor_id = $instructorId;
            $class->saveQuietly(); // The service owns the compatibility mirror on classes.
            $new = [];
            if ($instructorId) {
                $new[] = $this->create($class, $instructorId);
            }
            if ($target) {
                $target->assignment_revision++;
                $target->instructor_id = $old->instructor_id;
                $target->saveQuietly();
                $new[] = $this->create($target, $old->instructor_id);
            }
            $eventId = (string) Str::uuid();
            $details = [
                'event_id' => $eventId, 'operation' => $action, 'reason' => $input['reason'],
                'class_ids' => $ids, 'before' => $before,
                'after' => array_map(fn ($assignment) => $this->describe($assignment, $classes[$assignment->class_id]), $new),
            ];
            $this->auditLogger->log('changed_teaching_assignment', 'classes', $class->id, $details);

            return [
                'event_id' => $eventId,
                'classes' => $classes->values()->map(fn ($item) => $item->fresh()->load('activeTeachingAssignment.instructor', 'program')),
            ];
        }, 3);
    }

    private function checkRevision(ClassModel $class, int $expected): void
    {
        abort_if($class->assignment_revision !== $expected, 409,
            'This assignment changed since you opened it. Refresh the list and try again.');
    }

    private function describe(TeachingAssignment $assignment, ClassModel $class): array
    {
        return [
            ...$assignment->only(['id', 'class_id', 'instructor_id', 'version']),
            'subject_name' => $class->subject_name, 'program_id' => $class->program_id,
            'section' => $class->section, 'instructor_name' => $assignment->instructor?->name,
        ];
    }

    private function create(ClassModel $class, string $instructorId): TeachingAssignment
    {
        return TeachingAssignment::create([
            'class_id' => $class->id, 'instructor_id' => $instructorId,
            'version' => $class->assignment_revision, 'started_at' => now(),
        ]);
    }
}
