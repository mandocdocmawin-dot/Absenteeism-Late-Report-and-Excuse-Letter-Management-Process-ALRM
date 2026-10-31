<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use PhpOffice\PhpSpreadsheet\Cell\StringValueBinder;

class InstructorRequestExport extends StringValueBinder implements FromCollection, WithCustomValueBinder, WithHeadings, WithMapping
{
    public function __construct(private Collection $requests) {}

    public function collection(): Collection
    {
        return $this->requests;
    }

    public function headings(): array
    {
        return ['Subject', 'Year', 'Section', 'Student', 'Date of Occurrence', 'Type', 'Submitted', 'Date of Due', 'Request'];
    }

    public function map($request): array
    {
        $class = $request->historicalClass();
        $submitted = $request->date_submitted ?? $request->created_at;

        // Explicit string cells prevent student/class names from becoming Excel formulas.
        return [
            $class?->subject_name ?? '',
            $class?->year_level ?? '',
            $class?->section ?? '',
            $request->enrollment?->student?->name ?? '',
            $request->start_date_of_absence?->toDateString() ?? '',
            $request->type,
            $submitted?->toDateString() ?? '',
            $submitted?->copy()->addHours(config('alrm.followup_response_window_hours', 48))->toDateString() ?? '',
            $request->status,
        ];
    }
}
