<?php
// app/Services/AcademicPeriod.php

namespace App\Services;

use App\Models\AcademicTerm;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;

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
                ->orderByDesc('id')
                ->first();

            return [
                'semester'    => $term?->semester    ?? config('academic.current_semester'),
                'school_year' => $term?->school_year ?? config('academic.current_school_year'),
            ];
        });
    }

    public static function semester(): string   { return self::current()['semester']; }
    public static function schoolYear(): string { return self::current()['school_year']; }

    /** Optional historical filters must identify a complete academic period. */
    public static function filterRules(): array
    {
        return [
            'semester' => ['required_with:school_year', 'string', Rule::in(['1st', '2nd'])],
            'school_year' => [
                'bail', 'required_with:semester', 'string', 'regex:/\A[0-9]{4}-[0-9]{4}\z/',
                function ($attribute, $value, $fail) {
                    if (preg_match('/\A([0-9]{4})-([0-9]{4})\z/', $value, $years)
                        && (int) $years[2] !== (int) $years[1] + 1) {
                        $fail('The school year must contain consecutive years (e.g. 2026-2027).');
                    }
                },
            ],
        ];
    }

    /** @return array{semester: string, school_year: string} */
    public static function resolveFilters(Request $request): array
    {
        return $request->validate(self::filterRules()) + self::current();
    }

    public static function flush(): void
    {
        Cache::forget(self::key());
    }
}
