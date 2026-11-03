<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveClassRequest;
use App\Models\ClassModel;
use App\Models\Enrollment;
use App\Models\User;
use App\Services\AcademicPeriod;
use App\Services\AuditLoggerService;
use App\Support\BoundedCollection;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClassManagementController extends Controller
{
    public function __construct(
        protected AuditLoggerService $auditLogger,
    ) {}

    /**
     * GET /api/admin/classes
     */
    public function index(Request $request)
    {
        $request->validate([
            'program_id' => ['sometimes', 'uuid', 'exists:programs,id'],
            'search' => ['sometimes', 'string', 'max:120'],
        ]);

        $classes = ClassModel::query()
            ->select([
                'id', 'subject_name', 'section', 'semester', 'school_year',
                'instructor_id', 'program_id', 'year_level', 'schedule',
                'curriculum_subject_id', 'credit_units', 'weekly_hours',
                'meetings_per_week', 'assignment_revision',
            ])
            ->with([
                'instructor:id,name,email,role,status',
                'program:id,program_name',
                'activeTeachingAssignment:id,class_id,instructor_id,version,started_at,ended_at',
                'activeTeachingAssignment.instructor:id,name,email,role,status',
            ])
            ->withCount('enrollments')
            ->withCount(['requests as pending_requests_count' => fn ($query) => $query->where('status', 'pending')]);

        if ($request->filled('program_id')) {
            $classes->where('program_id', $request->query('program_id'));
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->query('search'));
            $classes->where(function (Builder $searchQuery) use ($search) {
                $searchQuery
                    ->where('subject_name', 'like', "%{$search}%")
                    ->orWhere('section', 'like', "%{$search}%")
                    ->orWhereHas('instructor', fn (Builder $query) => $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%"))
                    ->orWhereHas('program', fn (Builder $query) => $query->where('program_name', 'like', "%{$search}%"));
            });
        }

        return BoundedCollection::respond($classes);
    }

    /**
     * POST /api/admin/classes
     */
    public function store(SaveClassRequest $request)
    {
        $validated = $request->classAttributes();
        $class = DB::transaction(function () use ($validated) {
            $class = ClassModel::create($validated);
            $this->enrollMatchingStudents($class);
            $this->auditLogger->log('created_class', 'classes', $class->id);

            return $class;
        });

        return response()->json([
            'success' => true,
            'message' => 'Class created.',
            'data' => $class,
        ], 201);
    }

    /**
     * GET /api/admin/classes/{class}
     */
    public function show(ClassModel $class)
    {
        return response()->json([
            'success' => true,
            'message' => null,
            'data' => $class->load('instructor', 'program', 'enrollments.student', 'activeTeachingAssignment.instructor'),
        ]);
    }

    /**
     * PUT/PATCH /api/admin/classes/{class}
     */
    public function update(SaveClassRequest $request, ClassModel $class)
    {
        $validated = $request->classAttributes();
        DB::transaction(function () use ($class, $validated) {
            $fresh = ClassModel::whereKey($class->id)->lockForUpdate()->firstOrFail();
            $class->setRawAttributes($fresh->getAttributes(), true);
            $identity = ['subject_name', 'curriculum_subject_id', 'program_id', 'section', 'year_level', 'semester', 'school_year'];
            $class->fill($validated);
            abort_if($class->isDirty($identity) && ($class->teachingAssignments()->exists() || $class->enrollments()->exists()),
                409, 'This class has assignments or enrollments. Create/select another class and use change_subject instead.');
            $class->save();
            $this->enrollMatchingStudents($class->fresh());
            // Trackers depend on the class's contact hours, not its credit units.
            $class->enrollments()->with('attendanceTracker')->each(function ($enrollment) {
                $enrollment->attendanceTracker?->recompute();
            });
            $this->auditLogger->log('updated_class', 'classes', $class->id);
        });

        return response()->json([
            'success' => true,
            'message' => 'Class updated.',
            'data' => $class,
        ]);
    }

    /**
     * DELETE /api/admin/classes/{class}
     */
    public function destroy(ClassModel $class)
    {
        return DB::transaction(function () use ($class) {
            $class = ClassModel::whereKey($class->id)->lockForUpdate()->firstOrFail();
            if ($class->enrollments()->exists() || $class->teachingAssignments()->exists()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete a class with enrollments or assignment history. Use Remove assignment instead.',
                    'data' => null,
                ], 409);
            }

            $classId = $class->id;
            $class->delete();
            $this->auditLogger->log('deleted_class', 'classes', $classId);

            return response()->json([
                'success' => true,
                'message' => 'Class deleted.',
                'data' => null,
            ]);
        });
    }

    /**
     * Enroll all matching students (same program + year level) into the
     * class, but only if the class belongs to the CURRENT academic term.
     * Idempotent: firstOrCreate never duplicates an enrollment.
     */
    protected function enrollMatchingStudents(ClassModel $class): void
    {
        if (
            $class->semester !== AcademicPeriod::semester() ||
            $class->school_year !== AcademicPeriod::schoolYear()
        ) {
            return;
        }

        /** @var Builder<User> $students */
        $students = User::query()
            ->where('role', 'student')
            ->where('program_id', $class->program_id)
            ->where('year_level', $class->year_level);

        $students->each(function ($student) use ($class): void {
            /** @var User $student */
            Enrollment::firstOrCreate(
                ['student_id' => $student->id, 'class_id' => $class->id],
                ['year_level' => $class->year_level],
            );
        });
    }
}
