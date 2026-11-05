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

class StudentRequestUpdatedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        public ExcuseRequest $excuseRequest,
        public User $student,
        public ClassModel $class,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: '[ALRM] Update on Your Excuse Request');
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.student-request-update',
            with: [
                'viewUrl' => rtrim(config('app.frontend_url'), '/').'/dashboard',
            ],
        );
    }
}
