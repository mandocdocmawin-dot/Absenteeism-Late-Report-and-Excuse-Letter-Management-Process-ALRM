<?php

namespace App\Http\Controllers\Admin;

use App\Exports\ReportExport;
use App\Http\Controllers\Controller;
use App\Models\ExcuseRequest;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Facades\Excel;

class ReportController extends Controller
{
    /**
     * Hard ceiling on rows returned in a single export, regardless of
     * filters. Safety net on top of the date-range cap below — protects
     * against memory/timeout issues on Render if filters somehow still
     * resolve to a huge result set.
     */
    private const MAX_EXPORT_ROWS = 5000;

    /**
     * Max span (in days) allowed between date_from and date_to. Keeps a
     * single export request from pulling years of data at once.
     */
    private const MAX_DATE_RANGE_DAYS = 730; // ~2 years

    /**
     * Fallback lookback window applied when the caller supplies neither
     * date_from nor date_to, so "export everything" is never the default.
     */
    private const DEFAULT_LOOKBACK_DAYS = 365; // 1 year

    /**
     * Shared validation + default-window logic used by both preview()
     * and export(), so the two never drift out of sync on what counts
     * as a valid/filtered request.
     */
    private function resolveFilters(Request $request): array
    {
        $validated = $request->validate([
            'program_id' => ['nullable', 'string', 'uuid', 'exists:programs,id'],
            'status'     => ['nullable', 'string', Rule::in(['pending', 'approved', 'noted', 'invalid'])],
            'date_from'  => ['nullable', 'date'],
            'date_to'    => ['nullable', 'date', 'after_or_equal:date_from'],
        ]);

        if (empty($validated['date_from']) && empty($validated['date_to'])) {
            $validated['date_from'] = now()->subDays(self::DEFAULT_LOOKBACK_DAYS)->toDateString();
            $validated['date_to']   = now()->toDateString();
        }

        if (empty($validated['date_from'])) {
            $validated['date_from'] = Carbon::parse($validated['date_to'])
                ->subDays(self::DEFAULT_LOOKBACK_DAYS)
                ->toDateString();
        }
        if (empty($validated['date_to'])) {
            $validated['date_to'] = now()->toDateString();
        }

        return $validated;
    }

    /**
     * Builds the base ExcuseRequest query with all filters applied,
     * given an already-resolved $validated array from resolveFilters().
     */
    private function buildFilteredQuery(array $validated)
    {
        $from = Carbon::parse($validated['date_from'])->startOfDay();
        $to   = Carbon::parse($validated['date_to'])->endOfDay();

        $query = ExcuseRequest::query();

        if (! empty($validated['program_id'])) {
            $query->whereHas('enrollment.class', function ($q) use ($validated) {
                $q->where('program_id', $validated['program_id']);
            });
        }

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        $query->whereDate('start_date_of_absence', '>=', $from->toDateString())
              ->whereDate('start_date_of_absence', '<=', $to->toDateString());

        return $query;
    }

    /**
     * Dry-run of export(): applies the same filters and defaults, but
     * only returns a row count + the resolved date range as JSON — no
     * file is generated or downloaded. Lets the frontend show the user
     * "this will export N rows covering <range>" with a Confirm step
     * before actually hitting export().
     *
     * GET /api/admin/reports/preview
     * Optional filters: ?program_id=&status=&date_from=&date_to=
     */
    public function preview(Request $request)
    {
        $validated = $this->resolveFilters($request);

        $from = Carbon::parse($validated['date_from']);
        $to   = Carbon::parse($validated['date_to']);

        if ($from->diffInDays($to) > self::MAX_DATE_RANGE_DAYS) {
            return response()->json([
                'success' => false,
                'message' => 'Date range too large. Please limit exports to '
                    .self::MAX_DATE_RANGE_DAYS.' days or fewer.',
                'data'    => null,
            ], 422);
        }

        $count = $this->buildFilteredQuery($validated)->count();

        return response()->json([
            'success' => true,
            'message' => null,
            'data'    => [
                'row_count'        => $count,
                'exceeds_limit'    => $count > self::MAX_EXPORT_ROWS,
                'max_export_rows'  => self::MAX_EXPORT_ROWS,
                'date_from'        => $validated['date_from'],
                'date_to'          => $validated['date_to'],
                'used_default_range' => ! $request->filled('date_from') && ! $request->filled('date_to'),
            ],
        ]);
    }

    /**
     * College-wide export of excuse/late requests for records or
     * accreditation purposes (per Admin interview, Q27).
     *
     * Frontend should call preview() first and let the user confirm —
     * this endpoint still re-validates and re-caps everything itself
     * (never trust that preview() was actually called first).
     *
     * GET /api/admin/reports/export
     * Optional filters: ?program_id=&status=&date_from=&date_to=
     */
    public function export(Request $request)
    {
        $validated = $this->resolveFilters($request);

        $from = Carbon::parse($validated['date_from']);
        $to   = Carbon::parse($validated['date_to']);

        if ($from->diffInDays($to) > self::MAX_DATE_RANGE_DAYS) {
            return response()->json([
                'success' => false,
                'message' => 'Date range too large. Please limit exports to '
                    .self::MAX_DATE_RANGE_DAYS.' days or fewer.',
                'data'    => null,
            ], 422);
        }

        $query = $this->buildFilteredQuery($validated)->with([
            'enrollment.student',
            'enrollment.class.program',
            'enrollment.class.instructor',
            'reviewer',
            'followupFlag',
        ]);

        // Cheap count check before pulling the full result set into memory.
        $count = $query->count();

        if ($count > self::MAX_EXPORT_ROWS) {
            return response()->json([
                'success' => false,
                'message' => 'This export would contain '.$count.' rows, which exceeds the '
                    .self::MAX_EXPORT_ROWS.'-row limit. Please narrow your filters (smaller date range or add a program filter).',
                'data'    => null,
            ], 422);
        }

        $requests = $query->orderBy('start_date_of_absence')->get();

        $filename = 'alrm_requests_export_'.now()->format('Y-m-d_His').'.xlsx';

        return Excel::download(new ReportExport($requests), $filename);
    }
}