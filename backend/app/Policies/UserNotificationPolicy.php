<?php

namespace App\Policies;

use App\Models\User;
use App\Models\UserNotification;

class UserNotificationPolicy
{
    /**
     * A user may only view their own notifications.
     * Administrator does NOT get a blanket override here — notifications
     * are personal, not organizational data like Program/ClassModel.
     * (Flag this to the team if Admin support-visibility is actually
     * wanted; deliberately excluded by default to avoid over-broadening
     * access to what a user reads/is notified about.)
     */
    public function view(User $user, UserNotification $notification): bool
    {
        return $notification->user_id === $user->id;
    }

    /**
     * "Update" here means marking as read — same ownership rule as view.
     * No one else, not even an Administrator, marks another user's
     * notification as read on their behalf.
     */
    public function update(User $user, UserNotification $notification): bool
    {
        return $notification->user_id === $user->id;
    }
}