<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->status === 'approved' && $user->role === 'administrator';
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function delete(User $user, User $target): bool
    {
        return $this->viewAny($user);
    }

    /**
     * Anyone can view their own profile. Administrator: anyone.
     * Program Head: users in the program they head.
     */
    public function view(User $user, User $target): bool
    {
        if ($user->id === $target->id || $user->role === 'administrator') {
            return true;
        }

        $programIds = $user->headedProgramIds();

        return ($target->role === 'student' && in_array($target->program_id, $programIds, true))
            || ($target->role === 'instructor' && (
                $target->programs()->whereIn('programs.id', $programIds)->exists()
                || $target->classesTaught()->whereIn('program_id', $programIds)->exists()
            ));
    }

    /**
     * Role assignment stays administrator-only.
     */
    public function update(User $user, User $target): bool
    {
        return $this->viewAny($user);
    }
}
