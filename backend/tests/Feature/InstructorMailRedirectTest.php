<?php

namespace Tests\Feature;

use App\Mail\InstructorExcuseRequestMail;
use App\Models\ClassModel;
use App\Models\Enrollment;
use App\Models\ExcuseRequest;
use App\Models\TeachingAssignment;
use App\Models\User;
use App\Models\UserNotification;
use App\Notifications\SendOtpCode;
use App\Observers\ExcuseRequestObserver;
use App\Providers\AppServiceProvider;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Mail\MailManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class InstructorMailRedirectTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
            'mail.instructor_notify_allowlist' => [],
            'mail.instructor_test_recipient' => 'tester@example.com',
            'mail.test_recipient' => null,
        ]);
        DB::purge('sqlite');
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('user_id');
            $table->string('request_id');
            $table->string('type');
            $table->text('message');
            $table->string('channel');
            $table->dateTime('date_sent');
            $table->boolean('is_read');
        });
        Mail::fake();
    }

    public function test_only_request_mail_is_redirected_while_otp_keeps_the_user_recipient(): void
    {
        (new ExcuseRequestObserver)->created($this->request());

        Mail::assertQueued(InstructorExcuseRequestMail::class, fn ($mail) => $mail->hasTo('tester@example.com') && ! $mail->hasTo('teacher@example.com')
        );
        $this->assertSame('teacher-id', UserNotification::sole()->user_id);

        config(['mail.default' => 'array', 'mail.logo_url' => 'https://backend.example.com/images/mail/lv-logo.png']);
        Mail::swap(new MailManager($this->app));
        $user = new User(['name' => 'OTP User', 'email' => 'otp-user@example.com']);
        $user->notifyNow(new SendOtpCode('123456'));

        $messages = $this->arrayMailTransport()->messages();
        $this->assertCount(1, $messages);
        $this->assertSame('otp-user@example.com', $messages->first()->getOriginalMessage()->getTo()[0]->getAddress());
        $email = $messages->first()->getOriginalMessage();
        $this->assertSame('[ALRM] Your verification code', $email->getSubject());
        $this->assertStringContainsString('Your ALRM verification code:', $email->getHtmlBody());
        $this->assertStringContainsString('LA VERDAD CHRISTIAN COLLEGE, INC.', $email->getHtmlBody());
        $this->assertStringContainsString('src="https://backend.example.com/images/mail/lv-logo.png"', $email->getHtmlBody());
        $this->assertCount(0, $email->getAttachments());
        $this->assertStringContainsString('Your ALRM verification code is: 123456', $email->getTextBody());
        $this->assertStringContainsString('This code expires in approximately 5 minutes.', $email->getTextBody());
    }

    public function test_empty_test_recipient_restores_delivery_to_the_assigned_instructor(): void
    {
        config(['mail.instructor_test_recipient' => '']);

        (new ExcuseRequestObserver)->created($this->request());

        Mail::assertQueued(InstructorExcuseRequestMail::class, fn ($mail) => $mail->hasTo('teacher@example.com'));
    }

    public function test_otp_reaches_students_and_instructors_even_when_test_redirects_are_configured(): void
    {
        config([
            'mail.default' => 'array',
            'mail.test_recipient' => 'global-tester@example.com',
            'mail.program_head_test_recipient' => 'marwin.mandocdoc@student.laverdad.edu.ph',
        ]);
        Mail::swap(new MailManager($this->app));
        (new AppServiceProvider($this->app))->boot();

        foreach (['student', 'instructor'] as $role) {
            $user = new User(['name' => 'OTP User', 'role' => $role, 'email' => $role.'@example.com']);
            $user->notifyNow(new SendOtpCode('123456'));
        }
        $messages = $this->arrayMailTransport()->messages();
        $this->assertCount(2, $messages);
        $addresses = $messages->map(fn ($message) => $message->getOriginalMessage()->getTo()[0]->getAddress())->all();
        $this->assertEqualsCanonicalizing(['student@example.com', 'instructor@example.com'], $addresses);
    }

    private function request(): ExcuseRequest
    {
        $instructor = new User(['name' => 'Teacher', 'email' => 'teacher@example.com', 'status' => 'approved']);
        $instructor->forceFill(['google_id' => 'google-teacher', 'email_notifications_enabled' => true]);
        $instructor->id = 'teacher-id';
        $class = (new ClassModel(['subject_name' => 'Test Class']))->setRelation('instructor', $instructor);
        $enrollment = (new Enrollment)
            ->setRelation('student', new User(['name' => 'Student']))
            ->setRelation('class', $class);
        $request = new ExcuseRequest(['type' => 'absence']);
        $request->id = 'request-id';

        return $request->setRelation('enrollment', $enrollment)
            ->setRelation('teachingAssignment', (new TeachingAssignment)->setRelation('instructor', $instructor));
    }
}
