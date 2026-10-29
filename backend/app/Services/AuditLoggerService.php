<?php

namespace App\Services;

use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class AuditLoggerService
{
    public function log(string $action, string $tableAffected, int|string $recordId, ?array $details = null): AuditLog
    {
        return DB::transaction(function () use ($action, $tableAffected, $recordId, $details) {
            $log = AuditLog::create([
                'user_id' => Auth::id(),
                'action' => $action,
                'table_affected' => $tableAffected,
                'record_id' => $recordId,
                'timestamp' => now(),
                'details' => $details,
            ]);

            $this->notifyActivityViewers($log);

            return $log;
        });
    }

    private function notifyActivityViewers(AuditLog $log): void
    {
        if (! isset(AuditLogResource::ACTIONS[$log->action])
            || ! in_array($log->user?->role, ['student', 'instructor'], true)) {
            return;
        }

        $request = match ($log->table_affected) {
            'requests' => $log->excuseRequest,
            'followup_flags' => $log->followupFlag?->request,
            default => null,
        };
        if (! $request) {
            return;
        }

        $class = $request->enrollment?->class;
        $student = $request->enrollment?->student;
        $recipients = User::where('role', 'administrator')->where('status', 'approved')->get();
        if ($class?->program) {
            $recipients = $recipients->merge($class->program->notificationHeads());
        }

        $description = lcfirst(AuditLogResource::ACTIONS[$log->action]);
        $type = $request->type === 'late' ? 'late' : 'absence';
        $message = "{$log->user->name} {$description}: {$student?->name}'s {$type} request for {$class?->subject_name}.";

        foreach ($recipients->unique('id') as $recipient) {
            UserNotification::create([
                'user_id' => $recipient->id,
                'request_id' => $request->id,
                'type' => 'activity_'.$log->action,
                'message' => $message,
                'channel' => 'in_app',
                'date_sent' => $log->timestamp,
                'is_read' => false,
            ]);
        }
    }
}
