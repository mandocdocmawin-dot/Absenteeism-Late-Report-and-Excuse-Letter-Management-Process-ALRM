<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\Program;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AssignProgramHeads extends Command
{
    protected $signature = 'alrm:assign-program-heads {program} {users*}';

    protected $description = 'Grant explicit co-head access to existing staff accounts without replacing the primary head';

    public function handle(): int
    {
        $program = Program::findOrFail($this->argument('program'));
        $ids = array_unique($this->argument('users'));
        $users = User::whereIn('id', $ids)->get();
        if ($users->count() !== count($ids) || $users->contains(fn ($user) => ! in_array($user->role, ['instructor', 'program_head'], true))) {
            $this->error('Every supplied ID must identify an existing instructor or program head. No changes made.');

            return self::FAILURE;
        }

        DB::transaction(function () use ($users, $program) {
            foreach ($users as $user) {
                if ($user->role !== 'program_head') {
                    $previousRole = $user->role;
                    $user->update(['role' => 'program_head']);
                    $this->record($user, "console_role_changed:{$previousRole}->program_head");
                }
                $changes = $user->additionalHeadedPrograms()->syncWithoutDetaching([$program->id]);
                if ($changes['attached']) {
                    $this->record($user, 'console_assigned_program_co_head:'.$program->id);
                }
            }
        });
        foreach ($users as $user) {
            $this->info($user->id.' | '.$user->name.' | program_head | '.$program->program_name);
        }

        return self::SUCCESS;
    }

    private function record(User $user, string $action): void
    {
        // CLI has no authenticated actor; identify the subject and the console origin.
        AuditLog::create([
            'user_id' => $user->id, 'action' => $action, 'table_affected' => 'users',
            'record_id' => $user->id, 'timestamp' => now(),
        ]);
    }
}
