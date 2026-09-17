<?php

namespace App\Policies;

use App\Models\Program;
use App\Models\User;

class ProgramPolicy
{
    /**
     * Administrator: any program. Program Head: the one they head.
     * Everyone else: only the program they belong to.
     */
    public function view(User $user, Program $program): bool
    {
        return $user->role === 'administrator'
            || $program->program_head_id === $user->id
            || $program->id === $user->program_id;
    }

    public function create(User $user): bool
    {
        return $user->role === 'administrator';
    }

    public function update(User $user, Program $program): bool
    {
        return $user->role === 'administrator';
    }

    public function delete(User $user, Program $program): bool
    {
        return $user->role === 'administrator';
    }
}