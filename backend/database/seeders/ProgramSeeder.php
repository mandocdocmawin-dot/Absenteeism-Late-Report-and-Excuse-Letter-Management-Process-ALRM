<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Program;
use Illuminate\Database\Seeder;

class ProgramSeeder extends Seeder
{
    /**
     * List of program_name values to seed.
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
