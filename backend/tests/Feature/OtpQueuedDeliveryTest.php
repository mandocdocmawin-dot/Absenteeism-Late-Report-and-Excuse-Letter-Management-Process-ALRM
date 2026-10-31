<?php

namespace Tests\Feature;

use App\Http\Controllers\Auth\OtpController;
use App\Models\OtpCode;
use App\Notifications\SendOtpCode;
use Illuminate\Notifications\ChannelManager;
use Illuminate\Notifications\SendQueuedNotifications;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Tests\SecurityTestCase;

class OtpQueuedDeliveryTest extends SecurityTestCase
{
    public function test_issue_queues_encrypted_delivery_after_commit_without_contacting_mail_provider(): void
    {
        Notification::swap(new ChannelManager($this->app));
        Queue::fake();
        $this->app->detectEnvironment(fn () => 'production');
        $user = $this->user();

        OtpController::issue($user);

        $this->assertSame(1, OtpCode::where('user_id', $user->id)->count());
        Queue::assertPushed(SendQueuedNotifications::class, fn ($job) => $job->connection === 'database' && $job->afterCommit === true
            && $job->shouldBeEncrypted && $job->notification->shouldSend($user, 'mail')
        );
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_replaced_and_expired_codes_are_not_delivered_by_worker(): void
    {
        $user = $this->user();
        $otp = OtpCode::create([
            'user_id' => $user->id, 'code' => '123456', 'expires_at' => now()->addMinutes(5),
        ]);
        $notification = new SendOtpCode('123456', otpId: $otp->id);
        $this->assertTrue($notification->shouldSend($user, 'mail'));
        $otp->delete();
        $this->assertFalse($notification->shouldSend($user, 'mail'));

        $testNotification = new SendOtpCode('123456');
        $this->travel(6)->minutes();
        $this->assertFalse($testNotification->shouldSend($user, 'mail'));
    }
}
