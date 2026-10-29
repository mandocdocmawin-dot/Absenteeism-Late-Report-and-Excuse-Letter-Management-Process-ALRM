<?php

namespace App\Mail;

use App\Models\ClassModel;
use App\Models\ExcuseRequest;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InstructorFollowUpMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        public User $instructor,
        public User $student,
        public ClassModel $class,
        public ExcuseRequest $excuseRequest,
        public string $reviewUrl,
        public int $followupCount,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '[ALRM] Follow-up: Pending Excuse Request from '.$this->student->name,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.instructor-followup',
        );
    }
}
