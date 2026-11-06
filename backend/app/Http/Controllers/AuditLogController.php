<?php

namespace App\Http\Controllers;

use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\BoundedCollection;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless(in_array($user->role, ['administrator', 'program_head'], true), 403);

        $filters = $request->validate([
            'role' => ['sometimes', Rule::in(['student', 'instructor'])],
            'action' => ['sometimes', Rule::in([...array_keys(AuditLogResource::ACTIONS), 'Flagged'])],
            'user_id' => ['sometimes', 'uuid'],
            'request_id' => ['sometimes', 'uuid'],
            'class_id' => ['sometimes', 'uuid'],
            'search' => ['sometimes', 'string', 'max:120'],
            'from' => ['sometimes', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        if (($filters['action'] ?? null) === 'Flagged') {
            $filters['action'] = 'flagged_request';
        }

        $programIds = null;
        if ($user->role === 'program_head') {
            $programIds = $user->headedProgramIds();
            abort_unless($programIds !== [], 403, 'No program is assigned to this account.');
        }

        /** @var Builder<AuditLog> $query */
        $query = AuditLog::query()
            ->select(['id', 'user_id', 'action', 'table_affected', 'record_id', 'timestamp'])
            ->whereIn('action', array_keys(AuditLogResource::ACTIONS))
            ->where(function ($query) use ($filters) {
                $query->whereHas('user', function ($query) use ($filters) {
                    $query->whereIn('role', isset($filters['role']) ? [$filters['role']] : ['student', 'instructor']);
                });
                if (! isset($filters['role'])) {
                    $query->orWhere(fn ($query) => $query->whereNull('user_id')->where('action', 'flagged_request'));
                }
            })
            ->where(function ($query) use ($programIds, $filters) {
                $scope = function ($query) use ($programIds, $filters) {
                    if ($programIds) {
                        $query->whereHas('enrollment.class', fn ($query) => $query->whereIn('program_id', $programIds));
                    }
                    if (isset($filters['request_id'])) {
                        $query->whereKey($filters['request_id']);
                    }
                    if (isset($filters['class_id'])) {
                        $query->whereHas('enrollment.class', fn ($query) => $query->whereKey($filters['class_id']));
                    }
                };
                $query->where(function ($query) use ($scope) {
                    $query->where('table_affected', 'requests')->whereHas('excuseRequest', $scope);
                })->orWhere(function ($query) use ($scope) {
                    $query->where('table_affected', 'followup_flags')->whereHas('followupFlag.request', $scope);
                });
            })
            ->with([
                'user:id,name,role',
                'excuseRequest:id,enrollment_id,type,status,class_snapshot',
                'excuseRequest.enrollment:id,student_id,class_id',
                'excuseRequest.enrollment.student:id,name',
                'excuseRequest.enrollment.class:id,subject_name,program_id,instructor_id',
                'excuseRequest.enrollment.class.instructor:id,name,email,role,status',
                'followupFlag:id,request_id',
                'followupFlag.request:id,enrollment_id,type,status,class_snapshot',
                'followupFlag.request.enrollment:id,student_id,class_id',
                'followupFlag.request.enrollment.student:id,name',
                'followupFlag.request.enrollment.class:id,subject_name,program_id,instructor_id',
                'followupFlag.request.enrollment.class.instructor:id,name,email,role,status',
            ]);

        if (isset($filters['action'])) {
            $query->where('action', $filters['action']);
        }
        if (isset($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }
        if (isset($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function (Builder $searchQuery) use ($search) {
                $searchQuery
                    ->where('action', 'like', "%{$search}%")
                    ->orWhereHas('user', fn (Builder $userQuery) => $userQuery
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%"))
                    ->orWhereHas('excuseRequest.enrollment.student', fn (Builder $studentQuery) => $studentQuery->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('excuseRequest.enrollment.class', fn (Builder $classQuery) => $classQuery->where('subject_name', 'like', "%{$search}%"))
                    ->orWhereHas('followupFlag.request.enrollment.student', fn (Builder $studentQuery) => $studentQuery->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('followupFlag.request.enrollment.class', fn (Builder $classQuery) => $classQuery->where('subject_name', 'like', "%{$search}%"));
            });
        }
        if (isset($filters['from'])) {
            $query->where('timestamp', '>=', $filters['from'].' 00:00:00');
        }
        if (isset($filters['to'])) {
            $query->where('timestamp', '<', Carbon::parse($filters['to'])->addDay()->startOfDay());
        }

        $query->orderByDesc('timestamp')->orderByDesc('id');

        return BoundedCollection::respond($query, AuditLogResource::class);
    }
}
