<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    /**
     * Anyone can view their own profile. Administrator: anyone.
     * Program Head: users in the program they head.
     */
    public function view(User $user, User $target): bool
    {
        if ($user->id === $target->id || $user->role === 'administrator') {
            return true;
        }

        return $target->program?->program_head_id === $user->id;
    }

    /**
     * Role assignment stays administrator-only.
     */
    public function update(User $user, User $target): bool
    {
        return $user->role === 'administrator';
    }
}