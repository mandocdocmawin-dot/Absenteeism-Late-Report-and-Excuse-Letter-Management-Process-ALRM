<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class ProgramHeadAttendanceAlertMail extends Mailable implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(
        public string $recipientName,
        public string $studentName,
        public string $subjectName,
        public string $programName,
        public string $alertStatus,
        public string $alertMessage,
        public float $usedUnits,
        public float $allowedUnits,
    ) {}

    public function envelope(): Envelope
    {
        $label = match ($this->alertStatus) {
            'IR' => 'Attendance IR Drop Limit',
            'critical' => 'Critical Attendance Consultation',
            default => 'Preventive Attendance Warning',
        };

        return new Envelope(subject: "[ALRM] {$label} - {$this->studentName}");
    }

    public function content(): Content
    {
        return new Content(view: 'mail.program-head-attendance-alert');
    }
}
