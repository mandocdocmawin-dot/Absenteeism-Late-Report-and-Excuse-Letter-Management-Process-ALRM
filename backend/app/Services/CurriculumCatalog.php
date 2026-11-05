<?php

namespace App\Services;

use App\Models\Curriculum;
use Illuminate\Support\Facades\DB;

class CurriculumCatalog
{
    /** Each content revision is append-only; existing classes keep their subject IDs. */
    public function import(string $programId, array $snapshot): Curriculum
    {
        $revision = hash('sha256', json_encode($snapshot, JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($programId, $snapshot, $revision) {
            $curriculum = Curriculum::firstOrCreate([
                'program_id' => $programId, 'version' => $snapshot['version'], 'revision' => $revision,
            ], ['sources' => $snapshot['sources'] ?? []]);
            if (! $curriculum->wasRecentlyCreated) {
                return $curriculum;
            }
            foreach ($snapshot['subjects'] ?? [] as $subject) {
                $curriculum->subjects()->create($subject);
            }
            foreach ($snapshot['offerings'] ?? [] as $offering) {
                $curriculum->offerings()->create($offering);
            }

            return $curriculum;
        });
    }
}
