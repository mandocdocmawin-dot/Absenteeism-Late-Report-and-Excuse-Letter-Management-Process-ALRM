<?php

namespace App\Http\Controllers;

use App\Models\AcademicTerm;
use App\Services\AcademicPeriod;
use App\Services\AuditLoggerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AcademicPeriodController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => null,
            'data' => AcademicPeriod::current(),
        ]);
    }

    public function update(Request $request, AuditLoggerService $auditLogger): JsonResponse
    {
        DB::transaction(function () use ($request, $auditLogger) {
            $term = AcademicTerm::query()
                ->whereDate('starts_on', '<=', today())
                ->orderByDesc('starts_on')
                ->orderByDesc('id')
                ->lockForUpdate()
                ->first();

            $validated = $request->validate([
                'semester' => ['required', Rule::in(['1st', '2nd'])],
                'school_year' => [
                    'bail', 'required', 'string', 'regex:/\A[0-9]{4}-[0-9]{4}\z/',
                    function ($attribute, $value, $fail) {
                        if (preg_match('/\A([0-9]{4})-([0-9]{4})\z/', $value, $years)
                            && (int) $years[2] !== (int) $years[1] + 1) {
                            $fail('The school year must contain consecutive years (e.g. 2026-2027).');
                        }
                    },
                    Rule::unique('academic_terms', 'school_year')
                        ->where('semester', is_string($request->input('semester')) ? $request->input('semester') : null)
                        ->ignore($term?->id),
                ],
            ]);

            $term ??= new AcademicTerm(['starts_on' => today()]);
            $before = $term->only(['semester', 'school_year']);
            $term->fill($validated)->save();
            $auditLogger->log('updated_academic_period', 'academic_terms', $term->id, [
                'before' => $before,
                'after' => $term->only(['semester', 'school_year']),
            ]);
        });

        AcademicPeriod::flush();

        return response()->json([
            'success' => true,
            'message' => 'Academic period updated.',
            'data' => AcademicPeriod::current(),
        ]);
    }
}
