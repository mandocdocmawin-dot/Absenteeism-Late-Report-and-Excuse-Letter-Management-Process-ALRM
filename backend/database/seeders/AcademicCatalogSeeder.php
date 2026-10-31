<?php

namespace Database\Seeders;

use App\Models\Program;
use App\Services\CurriculumCatalog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AcademicCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $snapshots = json_decode(file_get_contents(__DIR__.'/data/academic_catalog.json'), true, flags: JSON_THROW_ON_ERROR);
        DB::transaction(function () use ($snapshots) {
            foreach ($snapshots as $snapshot) {
                $program = Program::firstOrCreate(['program_name' => $snapshot['program_name']]);
                unset($snapshot['program_name']);
                app(CurriculumCatalog::class)->import($program->id, $snapshot);
            }
        });
    }
}
