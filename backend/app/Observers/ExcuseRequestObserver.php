<?php

namespace App\Observers;

use App\Mail\InstructorExcuseRequestMail;
use App\Mail\StudentRequestUpdatedMail;
use App\Models\ClassModel;
use App\Models\Enrollment;
use App\Models\ExcuseRequest;
use App\Models\UserNotification;
use App\Services\MailDeliveryService;
use App\Services\RequestSnapshot;

class ExcuseRequestObserver
{
    public function creating(ExcuseRequest $excuseRequest): void
    {
        $enrollment = Enrollment::findOrFail($excuseRequest->enrollment_id);
        $class = ClassModel::whereKey($enrollment->class_id)->lockForUpdate()->firstOrFail();
        $assignment = $class->activeTeachingAssignment()->first();
        abort_unless($assignment && $assignment->instructor_id === $class->instructor_id,
            422, 'This class has no active teaching assignment.');
        $excuseRequest->forceFill(RequestSnapshot::capture($class, $assignment));
    }

    public function updating(ExcuseRequest $excuseRequest): void
    {
        if ($excuseRequest->isDirty(['teaching_assignment_id', 'class_snapshot', 'snapshot_source', 'enrollment_id'])) {
            throw new \LogicException('A submitted request assignment and snapshot are immutable.');
        }
    }

    public function created(ExcuseRequest $excuseRequest): void
    {
        $excuseRequest->loadMissing('enrollment.student', 'enrollment.class.instructor');
        $enrollment = $excuseRequest->enrollment;
        $student = $enrollment?->student;
        $class = $enrollment?->class;
        $instructor = $excuseRequest->teachingAssignment?->instructor;
        if (! $student || ! $class || ! $instructor || ! $instructor->canLogin()) {
            return;
        }

        // The in-app alert is independent of mail allowlists, redirects, or delivery.
        UserNotification::create([
            'user_id' => $instructor->id,
            'request_id' => $excuseRequest->id,
            'type' => 'new_request',
            'message' => "{$student->name} submitted a new {$excuseRequest->type} request for {$class->subject_name}.",
            'channel' => 'in_app',
            'date_sent' => now(),
            'is_read' => false,
        ]);

        app(MailDeliveryService::class)->queue(
            $instructor,
            new InstructorExcuseRequestMail($excuseRequest, $student, $instructor, $class),
            'instructor',
        );
    }

    public function updated(ExcuseRequest $excuseRequest): void
    {
        if (! $excuseRequest->wasChanged('status') || $excuseRequest->getOriginal('status') !== 'pending'
            || ! in_array($excuseRequest->status, ['approved', 'noted', 'invalid'], true)) {
            return;
        }

        $excuseRequest->loadMissing('enrollment.student', 'enrollment.class');
        $student = $excuseRequest->enrollment?->student;
        $class = $excuseRequest->enrollment?->class;
        if (! $student || ! $class) {
            return;
        }

        // The decision controller already creates the student's in-app alert.
        // Queue the email while the original pending status is still available;
        // MailDeliveryService defers dispatch until the transaction commits.
        app(MailDeliveryService::class)->queue(
            $student,
            new StudentRequestUpdatedMail($excuseRequest, $student, $class),
            'student',
        );
    }
}
