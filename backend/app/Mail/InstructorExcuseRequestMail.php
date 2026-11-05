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

class InstructorExcuseRequestMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        public ExcuseRequest $excuseRequest,
        public User $student,
        public User $instructor,
        public ClassModel $class,
    ) {}

    public function envelope(): Envelope
    {
        $label = $this->excuseRequest->type === 'late' ? 'Late' : 'Absence';

        return new Envelope(
            subject: "[ALRM] New {$label} Excuse Request - {$this->student->name}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.instructor-excuse-request',
            with: [
                'reviewUrl' => rtrim(config('app.frontend_url'), '/')
                    . '/instructor/class-requests',
            ],
        );
    }
}
