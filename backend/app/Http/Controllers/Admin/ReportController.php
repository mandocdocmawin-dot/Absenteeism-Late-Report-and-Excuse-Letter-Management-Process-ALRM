<?php

namespace App\Http\Controllers\Admin;

use App\Exports\ReportExport;
use App\Http\Controllers\Controller;
use App\Models\ExcuseRequest;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

class ReportController extends Controller
{
    /**
     * College-wide export of excuse/late requests for records or
     * accreditation purposes (per Admin interview, Q27).
     *
     * GET /api/admin/reports/export
     * Optional filters: ?program_id=&status=&date_from=&date_to=
     */
    public function export(Request $request)
    {
        $query = ExcuseRequest::with([
            'enrollment.student',
            'enrollment.class.program',
            'enrollment.class.instructor',
            'reviewer',
            'followupFlag',
        ]);

        if ($request->filled('program_id')) {
            $query->whereHas('enrollment.class', function ($q) use ($request) {
                $q->where('program_id', $request->query('program_id'));
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('start_date_of_absence', '>=', $request->query('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('start_date_of_absence', '<=', $request->query('date_to'));
        }

        $requests = $query->orderBy('start_date_of_absence')->get();

        $filename = 'alrm_requests_export_'.now()->format('Y-m-d_His').'.xlsx';

        return Excel::download(new ReportExport($requests), $filename);
    }
}