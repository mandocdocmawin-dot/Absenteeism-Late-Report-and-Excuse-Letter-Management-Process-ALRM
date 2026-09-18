<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SendOtpCode extends Notification
{
    use Queueable;

    public function __construct(
        private readonly string $code,
    ) {}

    /**
     * Get the notification's delivery channels.
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your ALRM Verification Code')
            ->greeting("Hello {$notifiable->name},")
            ->line('Use the code below to complete your login.')
            ->line("**{$this->code}**")
            ->line('This code will expire in 5 minutes.')
            ->line('If you did not request this code, you can safely ignore this email.');
    }
}