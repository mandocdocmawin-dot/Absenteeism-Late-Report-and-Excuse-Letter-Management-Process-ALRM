<?php
// app/Services/AcademicPeriod.php

namespace App\Services;

use App\Models\AcademicTerm;
use Illuminate\Support\Facades\Cache;

class AcademicPeriod
{
    private static function key(): string
    {
        return 'academic.current.' . today()->toDateString();
    }

    /** @return array{semester: string, school_year: string} */
    public static function current(): array
    {
        return Cache::remember(self::key(), 600, function () {
            $term = AcademicTerm::query()
                ->whereDate('starts_on', '<=', today())
                ->orderByDesc('starts_on')
                ->first();

            return [
                'semester'    => $term?->semester    ?? config('academic.current_semester'),
                'school_year' => $term?->school_year ?? config('academic.current_school_year'),
            ];
        });
    }

    public static function semester(): string   { return self::current()['semester']; }
    public static function schoolYear(): string { return self::current()['school_year']; }

    public static function flush(): void
    {
        Cache::forget(self::key());
    }
}