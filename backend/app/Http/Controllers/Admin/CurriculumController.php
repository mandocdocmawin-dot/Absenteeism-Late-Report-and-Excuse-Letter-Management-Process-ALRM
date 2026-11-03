<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Curriculum;
use App\Services\AuditLoggerService;
use App\Services\CurriculumCatalog;
use App\Support\BoundedCollection;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CurriculumController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewAny', Curriculum::class);
        $filters = $request->validate([
            'program_id' => ['sometimes', 'uuid', 'exists:programs,id'],
            'version' => ['sometimes', 'string', 'max:50'],
        ]);

        /** @var Builder<Curriculum> $curricula */
        $curricula = Curriculum::query();
        $curricula->where($filters)
            ->with('program')
            ->withCount(['subjects', 'offerings'])
            ->orderBy('version', 'desc');

        return BoundedCollection::respond($curricula);
    }

    public function show(Curriculum $curriculum)
    {
        Gate::authorize('view', $curriculum);

        return response()->json(['success' => true, 'data' => $curriculum->load('program', 'subjects', 'offerings')]);
    }

    /** A correction creates a new revision; existing subject IDs stay intact. */
    public function store(Request $request, CurriculumCatalog $catalog, AuditLoggerService $audit)
    {
        Gate::authorize('create', Curriculum::class);
        $validated = $request->validate([
            'program_id' => ['required', 'uuid', 'exists:programs,id'],
            'version' => ['required', 'string', 'max:50'],
            'sources' => ['sometimes', 'array', 'max:100'],
            'sources.*' => ['array:file,note'],
            'sources.*.file' => ['required', 'string', 'max:255'],
            'sources.*.note' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'subjects' => ['required', 'array', 'list', 'min:1', 'max:300'],
            'subjects.*' => ['required', 'array:year_level,semester,code,subject_name,credit_units,lecture_units,laboratory_units,units_text,source'],
            'subjects.*.year_level' => ['required', Rule::in(['1st', '2nd', '3rd', '4th'])],
            'subjects.*.semester' => ['required', Rule::in(['1st', '2nd', 'summer'])],
            'subjects.*.code' => ['required', 'string', 'max:100'],
            'subjects.*.subject_name' => ['required', 'string', 'max:255'],
            'subjects.*.credit_units' => ['nullable', 'numeric', 'between:0,100'],
            'subjects.*.lecture_units' => ['nullable', 'numeric', 'between:0,100'],
            'subjects.*.laboratory_units' => ['nullable', 'numeric', 'between:0,100'],
            'subjects.*.units_text' => ['nullable', 'string', 'max:100'],
            'subjects.*.source' => ['required', 'array:file,page,note'],
            'subjects.*.source.file' => ['required', 'string', 'max:255'],
            'subjects.*.source.page' => ['sometimes', 'integer', 'min:1'],
            'subjects.*.source.note' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);
        $identities = collect($validated['subjects'])->map(fn ($s) => json_encode([$s['year_level'], $s['semester'], mb_strtolower(trim($s['code']))]));
        if ($identities->unique()->count() !== $identities->count()) {
            throw ValidationException::withMessages(['subjects' => 'Subject codes must be unique within each year level and semester.']);
        }
        $programId = $validated['program_id'];
        unset($validated['program_id']);
        $curriculum = DB::transaction(function () use ($catalog, $programId, $validated, $audit) {
            $curriculum = $catalog->import($programId, $validated);
            if ($curriculum->wasRecentlyCreated) {
                $audit->log('created_curriculum_revision', 'curricula', $curriculum->id);
            }

            return $curriculum;
        });

        return response()->json(['success' => true, 'data' => $curriculum->load('subjects')], $curriculum->wasRecentlyCreated ? 201 : 200);
    }
}
