<?php

namespace App\Policies;

use App\Models\FollowupFlag;
use App\Models\User;

class FollowupFlagPolicy
{
    /**
     * Administrator: any flag. Program Head: only flags escalated to them.
     * Instructor: flags tied to their own class (visibility into why a
     * student got escalated).
     */
    public function view(User $user, FollowupFlag $flag): bool
    {
        if ($user->role === 'administrator' || $flag->escalated_to === $user->id) {
            return true;
        }

        return $flag->request->enrollment->class->instructor_id === $user->id;
    }

    /**
     * Only the Program Head it was escalated to (or admin) can resolve it.
     */
    public function update(User $user, FollowupFlag $flag): bool
    {
        return $user->role === 'administrator' || $flag->escalated_to === $user->id;
    }
}