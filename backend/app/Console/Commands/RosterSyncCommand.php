<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Database\Seeders\AdminUserSeeder;
use Database\Seeders\ClassSeeder;
use Database\Seeders\ProgramSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class RosterSyncCommand extends Command
{
    protected $signature = 'roster:sync';

    protected $description = 'Sync users and classes from the Google Sheets roster/schedule.';

    public function handle(): int
    {
        $this->info('Syncing programs...');

        try {
            (new ProgramSeeder())->run();
        } catch (\Throwable $e) {
            $this->error('ProgramSeeder failed: '.$e->getMessage());
            Log::error('roster:sync — ProgramSeeder failed', ['error' => $e->getMessage()]);

            return self::FAILURE;
        }

        $this->info('Syncing users from roster sheet...');

        try {
            (new AdminUserSeeder())->run();
        } catch (\Throwable $e) {
            $this->error('AdminUserSeeder failed: '.$e->getMessage());
            Log::error('roster:sync — AdminUserSeeder failed', ['error' => $e->getMessage()]);

            return self::FAILURE;
        }

        $this->info('Syncing classes from schedule sheet...');

        try {
            (new ClassSeeder())->run();
        } catch (\RuntimeException $e) {
            $this->error('ClassSeeder found unmatched instructors: '.$e->getMessage());
            Log::error('roster:sync — ClassSeeder unmatched instructors', ['error' => $e->getMessage()]);

            return self::FAILURE;
        } catch (\Throwable $e) {
            $this->error('ClassSeeder failed: '.$e->getMessage());
            Log::error('roster:sync — ClassSeeder failed', ['error' => $e->getMessage()]);

            return self::FAILURE;
        }

        $this->info('Roster sync complete.');

        return self::SUCCESS;
    }
}