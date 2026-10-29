<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\ClassModel;
use App\Models\Enrollment;
use App\Models\ExcuseRequest;
use App\Models\RequestAttachment;
use App\Models\User;
use App\Services\AuditLoggerService;
use App\Support\BoundedCollection;
use Illuminate\Http\Request as HttpRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RequestController extends Controller
{
    public function __construct(protected AuditLoggerService $auditLogger) {}

    /**
     * TODO (Future Feature): Draft Requests
     *
     * Approach: Option B — Backend-persisted draft
     *
     * Kailangang gawin paglaon:
     * 1. Dagdagan ng 'draft' sa status enum ng requests table
     *    (kasabay o hiwalay na migration mula sa 'cancelled' na kasalukuyang ginawa)
     * 2. Bagong endpoint: POST /requests/draft — save nang walang strict validation
     * 3. Bagong endpoint: PATCH /requests/{request}/submit — i-finalize ang draft,
     *    dito na lang mag-a-apply ang buong/strict validation rules
     *    (kagaya ng nasa store() ngayon)
     * 4. I-relax ang validation kapag naka-draft (hindi required lahat ng fields)
     * 5. I-update din ang ExcuseRequestPolicy — sino ba pwedeng mag-edit/mag-view
     *    ng sariling drafts
     * 6. Route additions sa api.php (student group)
     */

    /**
     * Store a new excuse/late request.
     * Enrollment is resolved from the authenticated student + class_id —
     * never trust enrollment_id from the client (see ExcuseRequest model doc).
     */
    public function store(HttpRequest $httpRequest)
    {
        $validated = $httpRequest->validate([
            'class_id' => ['required', 'string', 'uuid', 'exists:classes,id'],
            'teaching_assignment_id' => ['sometimes', 'uuid'],
            'type' => ['required', 'in:absence,late'],
            'subjects_missed' => ['required', 'string', 'max:255'],
            'minutes_late' => ['required_if:type,late', 'nullable', 'integer', 'min:1', 'max:999'],
            // This existing field stores the occurrence date for both absence and late requests.
            'start_date_of_absence' => ['required', 'date'],
            'end_date_of_absence' => ['nullable', 'date', 'after_or_equal:start_date_of_absence'],
            'reason' => ['required', 'string', 'max:600'],
            'evidence_file_url' => [
                'nullable',
                'uuid',
                Rule::exists('request_attachments', 'id')
                    ->where('user_id', $httpRequest->user()->id)
                    ->whereNull('excuse_request_id'),
            ],
            'evidence_type' => ['nullable', 'string', 'max:100'],
            'proof_types' => ['nullable', 'array', 'list', 'max:6'],
            'proof_types.*' => ['required', 'string', 'distinct', Rule::in(ExcuseRequest::PROOF_TYPES)],
            'guardian_name' => ['required', 'string', 'min:2', 'max:60', 'regex:/^[^\d]*$/'],
            'contact_number' => ['required', 'regex:/^(09\d{9}|\+639\d{9})$/'],
        ]);

        $enrollment = Enrollment::where('student_id', Auth::id())
            ->where('class_id', $validated['class_id'])
            ->first();

        if (! $enrollment) {
            return response()->json([
                'success' => false,
                'message' => 'You are not enrolled in this class.',
                'data' => null,
            ], 403);
        }

        if (! $enrollment->class->instructor()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'This class has no assigned instructor. Please select another class or contact an administrator.',
                'data' => null,
            ], 422);
        }

        $excuseRequest = DB::transaction(function () use ($httpRequest, $validated, $enrollment) {
            // The same lock serializes assignment changes and new submissions.
            $class = ClassModel::whereKey($enrollment->class_id)->lockForUpdate()->firstOrFail();
            $assignment = $class->activeTeachingAssignment()->first();
            abort_unless($assignment && $assignment->instructor_id === $class->instructor_id,
                422, 'This class has no active teaching assignment. Refresh the class list.');
            abort_if(isset($validated['teaching_assignment_id']) && $validated['teaching_assignment_id'] !== $assignment->id,
                409, 'The instructor assignment changed. Refresh the class list before submitting.');
            User::whereKey($httpRequest->user()->id)->lockForUpdate()->firstOrFail();
            $duplicate = ExcuseRequest::where('enrollment_id', $enrollment->id)
                ->where('type', $validated['type'])
                ->where('reason', $validated['reason'])
                ->where('subjects_missed', $validated['subjects_missed'])
                ->where('minutes_late', $validated['minutes_late'] ?? null)
                ->whereDate('start_date_of_absence', $validated['start_date_of_absence'])
                ->when($validated['end_date_of_absence'] ?? null,
                    fn ($query, $date) => $query->whereDate('end_date_of_absence', $date),
                    fn ($query) => $query->whereNull('end_date_of_absence'))
                ->where('created_at', '>', now()->subMinutes(5))
                ->exists();
            abort_if($duplicate, 409, 'This request was already submitted. Please check your records.');

            $excuseRequest = ExcuseRequest::create([
                'enrollment_id' => $enrollment->id,
                'type' => $validated['type'],
                'subjects_missed' => $validated['subjects_missed'],
                'minutes_late' => $validated['minutes_late'] ?? null,
                'start_date_of_absence' => $validated['start_date_of_absence'] ?? null,
                'end_date_of_absence' => $validated['end_date_of_absence'] ?? null,
                'reason' => $validated['reason'],
                'evidence_file_url' => $validated['evidence_file_url'] ?? null,
                'evidence_type' => $validated['evidence_type'] ?? null,
                'proof_types' => $validated['proof_types'] ?? null,
                'status' => 'pending',
                'date_submitted' => now(),
            ]);

            if (! empty($validated['evidence_file_url'])) {
                $linked = RequestAttachment::where('id', $validated['evidence_file_url'])
                    ->where('user_id', $httpRequest->user()->id)
                    ->whereNull('excuse_request_id')
                    ->update(['excuse_request_id' => $excuseRequest->id]);

                if ($linked === 0) {
                    throw ValidationException::withMessages([
                        'evidence_file_url' => 'The attachment is no longer available. Please upload it again.',
                    ]);
                }
            }

            $httpRequest->user()->update([
                'guardian_name' => $validated['guardian_name'],
                'contact_number' => $validated['contact_number'],
            ]);

            $this->auditLogger->log('submitted_request', 'requests', $excuseRequest->id);

            return $excuseRequest;
        });

        return response()->json([
            'success' => true,
            'message' => 'Request submitted.',
            'data' => $excuseRequest,
        ], 201);
    }

    /**
     * List all requests filed by the authenticated student.
     */
    public function index()
    {
        $requests = ExcuseRequest::whereHas('enrollment', function ($q) {
            $q->where('student_id', Auth::id());
        })->with('enrollment.class')->latest();

        return BoundedCollection::respond($requests);
    }

    /**
     * Show a single request — must belong to the authenticated student
     * (or a scoped instructor/program head/admin — see ExcuseRequestPolicy).
     */
    public function show(ExcuseRequest $request)
    {
        $this->authorize('view', $request);

        return response()->json([
            'success' => true,
            'message' => null,
            'data' => $request->load('enrollment.class', 'followupFlag'),
        ]);
    }

    /**
     * Update a request — only allowed while status is still 'pending'.
     */
    public function update(HttpRequest $httpRequest, ExcuseRequest $request)
    {
        $this->authorize('update', $request);

        if ($request->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'This request has already been reviewed and can no longer be edited.',
                'data' => null,
            ], 422);
        }

        $validated = $httpRequest->validate([
            'type' => ['required', 'in:absence,late'],
            'subjects_missed' => ['required', 'string', 'max:255'],
            'minutes_late' => ['required_if:type,late', 'nullable', 'integer', 'min:1', 'max:999'],
            'start_date_of_absence' => ['required', 'date'],
            'end_date_of_absence' => ['nullable', 'date', 'after_or_equal:start_date_of_absence'],
            'reason' => ['required', 'string', 'max:500'],
            'evidence_file_url' => ['nullable', 'uuid'],
            'evidence_type' => ['nullable', 'string', 'max:100'],
            'proof_types' => ['nullable', 'array', 'list', 'max:6'],
            'proof_types.*' => ['required', 'string', 'distinct', Rule::in(ExcuseRequest::PROOF_TYPES)],
        ]);

        return DB::transaction(function () use ($request, $validated) {
            $request = ExcuseRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();
            $this->authorize('update', $request);
            abort_if($request->status !== 'pending', 409, 'This request has already been reviewed.');

            if (array_key_exists('evidence_file_url', $validated)) {
                abort_if($validated['evidence_file_url'] !== $request->evidence_file_url,
                    422, 'Evidence cannot be replaced through this endpoint.');
            }
            $request->update($validated);
            if ($request->wasChanged()) {
                $this->auditLogger->log('updated_request', 'requests', $request->id);
            }

            return response()->json([
                'success' => true,
                'message' => 'Request updated.',
                'data' => $request->fresh(),
            ]);
        });
    }

    public function destroy(ExcuseRequest $request)
    {
        return DB::transaction(function () use ($request) {
            $request = ExcuseRequest::whereKey($request->id)->lockForUpdate()->firstOrFail();
            $this->authorize('update', $request);
            $request->update(['status' => 'cancelled']);
            $this->auditLogger->log('cancelled_request', 'requests', $request->id);

            return response()->json([
                'success' => true,
                'message' => 'Request cancelled.',
                'data' => $request->fresh(),
            ]);
        });
    }

    /**
     * NEW: I-stream ang attachment ng request. Ang ExcuseRequestPolicy
     * ang nagpapasya kung sino ang pwedeng tumingin.
     */
    public function evidence(ExcuseRequest $request)
    {
        $this->authorize('view', $request);

        $attachment = RequestAttachment::where('excuse_request_id', $request->id)->first();

        if (! $attachment) {
            return response()->json([
                'success' => false,
                'message' => 'No attachment available for this request.',
                'data' => null,
            ], 404);
        }

        $extension = $attachment->mime_type === 'application/pdf'
            ? 'pdf'
            : ($attachment->mime_type === 'image/png' ? 'png' : 'jpg');

        return response($attachment->data, 200, [
            'Content-Type' => $attachment->mime_type,
            'Content-Disposition' => 'inline; filename="attachment.'.$extension.'"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }
}
