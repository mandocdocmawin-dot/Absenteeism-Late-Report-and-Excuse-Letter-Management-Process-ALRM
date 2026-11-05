<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Program;
use Illuminate\Database\Seeder;

class ProgramSeeder extends Seeder
{
    /**
     * List of program_name values to seed.
     *
     * Note: BSABSAIS and BSISACT are single sheet tabs in
     * AdminUserSeeder but map to two separate programs here
     * (Accountancy / Accountancy Information System, and
     * Associate in Computer Technology / BSIS - see note below).
     * Instructors from those combined tabs are linked to only ONE
     * of the two programs as their "home" program_id (see
     * AdminUserSeeder::TAB_TO_PROGRAM_NAME comments for details).
     */
    private const array PROGRAM_NAMES = [
        'General Education',
        'Bachelor of Science in Social Work',
        'Bachelor of Science in Accountancy',
        'Bachelor of Science in Accounting Information System',
        'Bachelor of Science in Information System',
        'Associate in Computer Technology',
        'Bachelor of Arts in Broadcasting',
    ];

    public function run(): void
    {
        foreach (self::PROGRAM_NAMES as $programName) {
            Program::firstOrCreate([
                'program_name' => $programName,
            ]);
        }
    }
}