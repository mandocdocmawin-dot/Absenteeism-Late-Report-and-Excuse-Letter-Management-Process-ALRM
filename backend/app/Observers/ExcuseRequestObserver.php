<?php

namespace App\Observers;

use App\Mail\InstructorExcuseRequestMail;
use App\Mail\StudentRequestUpdatedMail;
use App\Models\ExcuseRequest;
use App\Models\UserNotification;
use App\Services\MailDeliveryService;

class ExcuseRequestObserver
{
    public function created(ExcuseRequest $excuseRequest): void
    {
        $excuseRequest->loadMissing('enrollment.student', 'enrollment.class.instructor');
        $enrollment = $excuseRequest->enrollment;
        $student = $enrollment?->student;
        $class = $enrollment?->class;
        $instructor = $class?->instructor;
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
