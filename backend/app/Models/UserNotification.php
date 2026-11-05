<?php

namespace App\Models;

use Database\Factories\UserNotificationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'request_id',
    'type',
    'message',
    'channel',
    'date_sent',
    'is_read',
])]
class UserNotification extends Model
{
    public function scopeInApp(Builder $query): Builder
    {
        return $query->where('channel', 'in_app');
    }

    /** @use HasFactory<UserNotificationFactory> */
    use HasFactory, HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    // Actual table name is 'notifications'
    protected $table = 'notifications';

    // No updated_at — table only has date_sent
    public $timestamps = false;

    /*
    |--------------------------------------------------------------------------
    | Casts
    |--------------------------------------------------------------------------
    */

    protected function casts(): array
    {
        return [
            'date_sent' => 'datetime',
            'is_read' => 'boolean',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    /**
     * The user who received this notification.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The request that triggered this notification (nullable).
     */
    public function request(): BelongsTo
    {
        return $this->belongsTo(ExcuseRequest::class, 'request_id');
    }
}
