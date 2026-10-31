<?php

namespace App\Notifications;

use App\Models\OtpCode;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SendOtpCode extends Notification implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 40;

    private readonly DateTimeInterface $deliveryDeadline;

    public function __construct(
        private readonly string $code,
        private readonly int $expiresInMinutes = 5,
        private readonly ?string $otpId = null,
        ?DateTimeInterface $expiresAt = null,
    ) {
        $this->deliveryDeadline = $expiresAt ?? now()->addMinutes($expiresInMinutes);
        $this->afterCommit();
    }

    public function viaConnections(): array
    {
        return ['mail' => app()->environment('production')
            ? config('mail.otp_queue_connection', 'database')
            : config('queue.default')];
    }

    public function backoff(): array
    {
        return [10, 30];
    }

    public function retryUntil(): DateTimeInterface
    {
        return $this->deliveryDeadline;
    }

    public function shouldSend(object $notifiable, string $channel): bool
    {
        if (now()->greaterThanOrEqualTo($this->deliveryDeadline)) {
            return false;
        }

        // A resend deletes the previous code. Never deliver a queued code
        // that has since been replaced, used, expired, or locked out.
        return $this->otpId === null || OtpCode::whereKey($this->otpId)
            ->where('user_id', $notifiable->id)
            ->whereNull('verified_at')
            ->where('expires_at', '>', now())
            ->where('attempts', '<', 5)
            ->exists();
    }

    /**
     * Get the notification's delivery channels.
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     *
     * Uses a fully custom Blade view (resources/views/emails/otp-code.blade.php)
     * instead of the default Markdown mail template, so we control the
     * ALRM branding, layout, and authentication-specific security notice.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $remainingMinutes = max(1, (int) ceil(
            ($this->deliveryDeadline->getTimestamp() - now()->getTimestamp()) / 60
        ));

        return (new MailMessage)
            ->subject('[ALRM] Your verification code')
            ->view(['html' => 'emails.otp-code', 'text' => 'emails.otp-code-text'], [
                'name' => $notifiable->name,
                'code' => $this->code,
                'expiresInMinutes' => $remainingMinutes,
                'expiresAtUtc' => CarbonImmutable::instance($this->deliveryDeadline)
                    ->utc()->toDateTimeString().' UTC',
            ]);
    }
}
