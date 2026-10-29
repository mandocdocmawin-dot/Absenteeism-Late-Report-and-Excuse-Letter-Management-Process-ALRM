<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    public const ACTIONS = [
        'submitted_request' => 'Submitted a request',
        'updated_request' => 'Updated a request',
        'cancelled_request' => 'Cancelled a request',
        'followed_up_request' => 'Followed up a request',
        'decided_request_approved' => 'Approved a request',
        'decided_request_noted' => 'Noted a request',
        'decided_request_invalid' => 'Marked a request invalid',
        'resolved_followup_flag' => 'Resolved a follow-up',
    ];

    public function toArray(Request $request): array
    {
        $excuseRequest = $this->table_affected === 'requests'
            ? $this->excuseRequest
            : $this->followupFlag?->request;
        $enrollment = $excuseRequest?->enrollment;

        return [
            'id' => $this->id,
            'action' => $this->action,
            'description' => self::ACTIONS[$this->action],
            'timestamp' => $this->timestamp?->toIso8601String(),
            'actor' => $this->user?->only(['id', 'name', 'role']),
            'table_affected' => $this->table_affected,
            'record_id' => $this->record_id,
            'request' => $excuseRequest ? [
                'id' => $excuseRequest->id,
                'type' => $excuseRequest->type,
                'current_status' => $excuseRequest->status,
                'student' => $enrollment?->student?->only(['id', 'name']),
                'class' => $excuseRequest->class_snapshot !== null
                    ? array_intersect_key($excuseRequest->class_snapshot, array_flip(['id', 'subject_name', 'program_id', 'instructor_id']))
                    : $enrollment?->class?->only(['id', 'subject_name', 'program_id', 'instructor_id']),
            ] : null,
        ];
    }
}
