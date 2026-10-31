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
            'action' => ['sometimes', Rule::in(array_keys(AuditLogResource::ACTIONS))],
            'user_id' => ['sometimes', 'uuid'],
            'request_id' => ['sometimes', 'uuid'],
            'from' => ['sometimes', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $programIds = null;
        if ($user->role === 'program_head') {
            $programIds = $user->headedProgramIds();
            abort_unless($programIds !== [], 403, 'No program is assigned to this account.');
        }

        /** @var Builder<AuditLog> $query */
        $query = AuditLog::query()
            ->whereIn('action', array_keys(AuditLogResource::ACTIONS))
            ->whereHas('user', function ($query) use ($filters) {
                $query->whereIn('role', isset($filters['role']) ? [$filters['role']] : ['student', 'instructor']);
            })
            ->where(function ($query) use ($programIds, $filters) {
                $scope = function ($query) use ($programIds, $filters) {
                    if ($programIds) {
                        $query->whereHas('enrollment.class', fn ($query) => $query->whereIn('program_id', $programIds));
                    }
                    if (isset($filters['request_id'])) {
                        $query->whereKey($filters['request_id']);
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
                'excuseRequest.enrollment.student:id,name',
                'excuseRequest.enrollment.class:id,subject_name,program_id,instructor_id',
                'followupFlag.request.enrollment.student:id,name',
                'followupFlag.request.enrollment.class:id,subject_name,program_id,instructor_id',
            ]);

        if (isset($filters['action'])) {
            $query->where('action', $filters['action']);
        }
        if (isset($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
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
