<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class MailDeliveryService
{
    /** Queue request mail only for linked accounts that opted in. */
    public function queue(User $user, Mailable $mail, string $audience): bool
    {
        if (! $user->canReceiveEmailNotifications()) {
            return false;
        }

        if ($audience === 'instructor') {
            $allowlist = array_map(fn ($email) => strtolower(trim($email)), config('mail.instructor_notify_allowlist', []));
            if ($allowlist !== [] && ! in_array(strtolower(trim($user->email)), $allowlist, true)) {
                Log::info('Request email skipped: instructor is not in the allowlist.', ['user_id' => $user->id]);

                return false;
            }
        }

        $testRecipient = match ($audience) {
            'instructor' => trim((string) config('mail.instructor_test_recipient', '')),
            'student' => trim((string) config('mail.student_test_recipient', '')),
            default => '',
        };
        if ($testRecipient === '') {
            $testRecipient = trim((string) config('mail.test_recipient', ''));
        }

        try {
            Mail::to($testRecipient !== '' ? $testRecipient : $user->email, $testRecipient !== '' ? null : $user->name)
                ->queue($mail->afterCommit());

            return true;
        } catch (Throwable $exception) {
            report($exception);

            return false;
        }
    }
}
