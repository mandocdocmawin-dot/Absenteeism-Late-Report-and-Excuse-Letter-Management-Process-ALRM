<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\SendOtpCode;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class OtpEmailContentTest extends TestCase
{
    public function test_notification_produces_multipart_email_with_preheader_and_continuous_leading_zero_digits(): void
    {
        $this->freezeTime();
        config(['mail.default' => 'array']);
        $user = new User(['name' => 'OTP Test', 'email' => 'otp@example.test']);
        $deadline = now()->addMinutes(5);
        $notification = new SendOtpCode('004217', expiresAt: $deadline);
        $this->travel(121)->seconds();

        $user->notifyNow($notification);
        $email = $this->arrayMailTransport()->messages()->sole()->getOriginalMessage();
        $html = $email->getHtmlBody();
        $text = $email->getTextBody();
        $this->assertSame('[ALRM] Your verification code', $email->getSubject());
        $this->assertStringContainsString('multipart/alternative', $email->toString());
        $this->assertStringContainsString('<meta name="color-scheme" content="light">', $html);
        $this->assertStringContainsString('<title>Your ALRM verification code</title>', $html);
        $this->assertMatchesRegularExpression('/<body[^>]*>\s*<div[^>]*display:none!important[^>]*>\s*Your ALRM verification code is 004217\. It expires in 3 minutes\./', $html);
        $this->assertMatchesRegularExpression('/<p[^>]*letter-spacing:4px[^>]*white-space:nowrap[^>]*user-select:all[^>]*>004217<\/p>/', $html);
        $this->assertStringNotContainsString('0 0 4 2 1 7', $html);
        $this->assertStringNotContainsString('#8a94a6', $html);
        $this->assertStringNotContainsString('#9aa3b2', $html);
        $this->assertStringContainsString('#6b7385', $html);
        $this->assertStringStartsWith('Your ALRM verification code is: 004217', $text);
        foreach ([$html, $text] as $body) {
            $this->assertStringContainsString('ALRM sign-in', $body);
            $this->assertStringContainsString('expires in approximately', $body);
            $this->assertStringContainsString('Valid until '.$deadline->copy()->utc()->toDateTimeString().' UTC', $body);
        }
        $this->assertStringContainsString('approximately 3 minutes', $text);
    }

    public function test_remaining_minutes_round_up_with_minimum_one_and_suppression_at_deadline(): void
    {
        $this->freezeTime();
        $user = new User(['name' => 'OTP Test']);
        $deadline = now()->addSeconds(1);
        $notification = new SendOtpCode('004217', expiresAt: $deadline);

        $this->assertSame(1, $notification->toMail($user)->viewData['expiresInMinutes']);
        $this->assertTrue($notification->shouldSend($user, 'mail'));
        $this->travel(1)->seconds();
        $this->assertFalse($notification->shouldSend($user, 'mail'));
        $this->assertSame(1, $notification->toMail($user)->viewData['expiresInMinutes']);
        $this->assertTrue($deadline->equalTo($notification->retryUntil()));
    }

    public function test_templates_can_render_without_an_absolute_expiry(): void
    {
        foreach (['emails.otp-code', 'emails.otp-code-text'] as $view) {
            $body = view($view, ['name' => 'OTP Test', 'code' => '004217'])->render();
            $this->assertStringContainsString('5 minutes', $body);
            $this->assertStringNotContainsString('Valid until', $body);
        }
    }
}
