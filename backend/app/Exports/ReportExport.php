<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use PhpOffice\PhpSpreadsheet\Cell\StringValueBinder;

class ReportExport extends StringValueBinder implements FromCollection, WithCustomValueBinder, WithHeadings, WithMapping
{
    public function __construct(protected Collection $requests) {}

    public function collection(): Collection
    {
        return $this->requests;
    }

    public function headings(): array
    {
        return [
            'Request ID', 'Student', 'Program', 'Subject', 'Instructor',
            'Type', 'Start Date', 'End Date', 'Reason', 'Status',
            'Reviewed By', 'Date Reviewed', 'Flagged (IR)',
        ];
    }

    public function map($r): array
    {
        return [
            $r->id,
            $r->enrollment->student->name ?? '',
            $r->class_snapshot['program']['program_name'] ?? $r->enrollment->class->program->program_name ?? '',
            $r->class_snapshot['subject_name'] ?? $r->enrollment->class->subject_name ?? '',
            $r->class_snapshot !== null ? ($r->class_snapshot['instructor']['name'] ?? '') : ($r->enrollment->class->instructor->name ?? ''),
            $r->type,
            optional($r->start_date_of_absence)->toDateString(),
            optional($r->end_date_of_absence)->toDateString(),
            $r->reason,
            $r->status,
            $r->reviewer->name ?? '',
            optional($r->date_reviewed)->toDateTimeString(),
            $r->followupFlag ? 'Yes' : 'No',
        ];
    }
}
