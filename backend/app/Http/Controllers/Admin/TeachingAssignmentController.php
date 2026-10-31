<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ClassModel;
use App\Models\ExcuseRequest;
use App\Services\TeachingAssignmentService;
use App\Support\BoundedCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TeachingAssignmentController extends Controller
{
    public function history(ClassModel $class): JsonResponse
    {
        $this->authorize('update', $class);

        return response()->json(['success' => true, 'message' => null, 'data' => [
            'class_id' => $class->id, 'assignment_revision' => $class->assignment_revision,
            'assignments' => $class->teachingAssignments()->with('instructor:id,name')->orderByDesc('version')->get(),
            'events' => AuditLog::where('action', 'changed_teaching_assignment')
                ->whereJsonContains('details->class_ids', $class->id)
                ->with('user:id,name')->orderByDesc('timestamp')->limit(100)->get(),
        ]]);
    }

    public function pendingRequests(ClassModel $class): JsonResponse
    {
        $this->authorize('update', $class);

        return BoundedCollection::respond(ExcuseRequest::whereHas('enrollment', fn ($query) => $query->where('class_id', $class->id))
            ->where('status', 'pending')
            ->with('enrollment.student:id,name', 'enrollment.class')->latest('requests.created_at'));
    }

    public function change(Request $request, ClassModel $class, TeachingAssignmentService $service): JsonResponse
    {
        $this->authorize('update', $class);
        $input = $request->validate([
            'action' => ['required', Rule::in(['assign', 'change_instructor', 'change_subject', 'swap', 'remove'])],
            'expected_revision' => ['required', 'integer', 'min:0'],
            'instructor_id' => ['required_if:action,assign,change_instructor', 'nullable', 'uuid', 'exists:users,id'],
            'target_class_id' => ['required_if:action,change_subject,swap', 'nullable', 'uuid', 'exists:classes,id'],
            'target_expected_revision' => ['required_if:action,change_subject,swap', 'nullable', 'integer', 'min:0'],
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        return response()->json([
            'success' => true, 'message' => 'Teaching assignment updated.',
            'data' => $service->change($class->id, $input),
        ]);
    }
}
