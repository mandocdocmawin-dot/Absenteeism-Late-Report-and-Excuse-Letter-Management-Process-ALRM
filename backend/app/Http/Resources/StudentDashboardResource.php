<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StudentDashboardResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'total_classes'        => $this->resource['total_classes'],
            'unexcused_absences'   => $this->resource['unexcused_absences'],
            'excused_absences'     => $this->resource['excused_absences'],
            'lates_recorded'       => $this->resource['lates_recorded'],
            'pending_requests'     => $this->resource['pending_requests'],
            'threshold'            => $this->resource['threshold'],
            'unread_notifications' => $this->resource['unread_notifications'],
            'recent_notifications' => $this->resource['recent_notifications']->map(fn ($notification) => [
                'id'        => $notification->id,
                'type'      => $notification->type,
                'message'   => $notification->message,
                'date_sent' => $notification->date_sent,
                'is_read'   => $notification->is_read,
            ])->values(),
        ];
    }
}