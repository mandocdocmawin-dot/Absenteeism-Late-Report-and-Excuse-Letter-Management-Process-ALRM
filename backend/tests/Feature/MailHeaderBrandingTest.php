<?php

namespace Tests\Feature;

use App\Mail\InstructorExcuseRequestMail;
use App\Mail\InstructorFollowUpMail;
use App\Mail\ProgramHeadAttendanceAlertMail;
use App\Mail\StudentRequestUpdatedMail;
use App\Models\ClassModel;
use App\Models\ExcuseRequest;
use App\Models\Program;
use App\Models\User;
use App\Notifications\SendOtpCode;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class MailHeaderBrandingTest extends TestCase
{
    public function test_all_email_types_have_a_hosted_logo_in_the_header_without_attachments(): void
    {
        $logoUrl = 'https://backend.example.com/images/mail/lv-logo.png';
        config(['mail.default' => 'array', 'mail.logo_url' => $logoUrl]);
        $student = new User(['name' => 'Student', 'email' => 'student@example.com']);
        $instructor = new User(['name' => 'Instructor', 'email' => 'teacher@example.com']);
        $class = (new ClassModel(['subject_name' => 'Test Subject', 'year_level' => '3rd']))
            ->setRelation('program', new Program(['program_name' => 'BSIS']));
        $request = new ExcuseRequest([
            'type' => 'absence', 'reason' => 'Test reason', 'subjects_missed' => 'Test Subject',
        ]);

        foreach ([
            new InstructorExcuseRequestMail($request, $student, $instructor, $class),
            new InstructorFollowUpMail($instructor, $student, $class, $request, 'https://frontend.example.com/review', 1),
            new StudentRequestUpdatedMail($request, $student, $class),
            new ProgramHeadAttendanceAlertMail('Program Head', 'Student', 'Test Subject', 'BSIS', 'warning', 'Attendance warning.', 3, 10),
        ] as $mail) {
            $mail->to('recipient@example.com')->send(Mail::mailer());
        }
        $student->notifyNow(new SendOtpCode('123456'));

        $messages = $this->arrayMailTransport()->messages();
        $this->assertCount(5, $messages);
        foreach ($messages as $sent) {
            $email = $sent->getOriginalMessage();
            $html = $email->getHtmlBody();
            $this->assertCount(0, $email->getAttachments());
            $this->assertStringContainsString('src="'.$logoUrl.'"', $html);
            $this->assertStringContainsString('LA VERDAD CHRISTIAN COLLEGE, INC.', $html);
            $this->assertStringNotContainsString('cid:', $html);
            $this->assertLessThan(strpos($html, 'LA VERDAD CHRISTIAN COLLEGE, INC.'), strpos($html, '<img '));
        }
    }
}
