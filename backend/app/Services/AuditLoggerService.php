<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;

class AuditLoggerService
{
    public function log(string $action, string $tableAffected, int $recordId): AuditLog
    {
        return AuditLog::create([
            'user_id'        => Auth::id(),
            'action'         => $action,
            'table_affected' => $tableAffected,
            'record_id'      => $recordId,
            'timestamp'      => now(),
        ]);
    }
}