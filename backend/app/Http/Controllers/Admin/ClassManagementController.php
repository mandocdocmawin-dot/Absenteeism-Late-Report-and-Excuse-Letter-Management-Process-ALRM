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
use Illuminate\Support\Facades\DB;

class ClassManagementController extends Controller
{
    public function __construct(
        protected AuditLoggerService $auditLogger,
    ) {}

    /**
     * GET /api/admin/classes
     */
    public function index()
    {
        $classes = ClassModel::with('instructor', 'program')->withCount('enrollments');

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
            'data' => $class->load('instructor', 'program', 'enrollments.student'),
        ]);
    }

    /**
     * PUT/PATCH /api/admin/classes/{class}
     */
    public function update(SaveClassRequest $request, ClassModel $class)
    {
        $validated = $request->classAttributes();
        DB::transaction(function () use ($class, $validated) {
            $class->update($validated);
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
        if ($class->enrollments()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete a class that still has enrollments.',
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
