<?php

namespace App\Http\Controllers\Instructor;

use App\Exports\InstructorRequestExport;
use App\Http\Controllers\Controller;
use App\Models\ExcuseRequest;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Facades\Excel;

class InstructorRequestExportController extends Controller
{
    private const MAX_EXPORT_ROWS = 5000;

    public function export(Request $request)
    {
        $filters = $request->validate([
            'class_id' => ['nullable', 'uuid', Rule::exists('teaching_assignments', 'class_id')->where('instructor_id', $request->user()->id)],
            'type' => ['nullable', Rule::in(['absence', 'late'])],
            'status' => ['nullable', Rule::in(['pending', 'approved', 'noted', 'invalid', 'cancelled'])],
            'search' => ['nullable', 'string', 'max:50'],
        ]);

        $query = ExcuseRequest::forInstructor($request->user()->id)->whereHas('enrollment.class', function ($query) use ($filters) {
            if (! empty($filters['class_id'])) {
                $query->whereKey($filters['class_id']);
            }
        });

        foreach (['type', 'status'] as $field) {
            if (! empty($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }

        if (isset($filters['search']) && trim($filters['search']) !== '') {
            $search = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], trim($filters['search'])).'%';
            $query->whereHas('enrollment.student', fn ($query) => $query
                ->whereRaw("LOWER(name) LIKE LOWER(?) ESCAPE '!'", [$search]));
        }

        // Check bounded IDs before loading models/relations to reject large exports cheaply.
        $count = (clone $query)->limit(self::MAX_EXPORT_ROWS + 1)->toBase()->pluck('requests.id')->count();
        abort_if($count > self::MAX_EXPORT_ROWS, 422,
            'Export exceeds the 5000-row limit. Narrow the class, type, status or search filters.');

        // Keep the fetch bounded as well in case requests are inserted after the size check.
        $requests = $query->select([
            'id', 'enrollment_id', 'teaching_assignment_id', 'class_snapshot', 'type', 'status', 'start_date_of_absence', 'date_submitted', 'created_at',
        ])->with([
            'enrollment:id,student_id,class_id',
            'enrollment.student:id,name',
            'enrollment.class:id,subject_name,year_level,section',
        ])->orderByDesc('date_submitted')->orderBy('id')->limit(self::MAX_EXPORT_ROWS + 1)->get();

        abort_if($requests->count() > self::MAX_EXPORT_ROWS, 422,
            'Export exceeds the 5000-row limit. Narrow the class, type, status or search filters.');

        return Excel::download(
            new InstructorRequestExport($requests),
            'instructor-class-requests-'.now()->format('Y-m-d_His').'.xlsx',
            \Maatwebsite\Excel\Excel::XLSX,
        );
    }
}
