<?php

namespace App\Console\Commands;

use App\Models\TrustedDevice;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class RepairStudentInstructorRoles extends Command
{
    protected $signature = 'alrm:repair-student-instructors {--apply : Restore non-allowlisted student-domain instructors to student}';

    protected $description = 'Audit student-domain instructor roles; repair only with --apply.';

    public function handle(): int
    {
        $domain = strtolower((string) config('institution.student_domain'));
        if ($domain === '') {
            $this->error('Student domain is not configured. No changes made.');

            return self::FAILURE;
        }
        $users = DB::transaction(function () use ($domain) {
            $users = User::where('role', 'instructor')
                ->whereRaw('LOWER(email) LIKE ?', ['%@'.$domain])
                ->whereNotIn(DB::raw('LOWER(email)'), User::STUDENT_INSTRUCTOR_EMAILS)
                ->lockForUpdate()->get();
            foreach ($users as $user) {
                $this->line($user->email.' : instructor -> student');
                if ($this->option('apply') && ($user->classesTaught()->exists()
                    || $user->headedProgramIds() !== [] || $user->programs()->exists())) {
                    throw new RuntimeException('Unexpected teaching/head assignments found. Transaction rolled back; review assignments before repair.');
                }
            }
            if ($this->option('apply')) {
                foreach ($users as $user) {
                    $user->update(['role' => 'student']);
                    $user->tokens()->delete();
                    TrustedDevice::where('user_id', $user->id)->delete();
                }
            }

            return $users;
        });
        if ($this->option('apply')) {
            foreach ($users as $user) {
                Log::notice('Student instructor role repaired by console command', [
                    'user_id' => $user->id, 'previous_role' => 'instructor', 'role' => 'student',
                ]);
            }
        }
        $count = $users->count();
        $this->info($this->option('apply') ? "Restored {$count} student account(s)." : "Found {$count} account(s). Dry run; no changes made.");

        return self::SUCCESS;
    }
}
