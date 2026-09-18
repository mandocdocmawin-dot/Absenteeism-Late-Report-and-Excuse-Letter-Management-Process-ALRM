<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['request_id', 'flagged_date', 'escalated_to', 'status'])]
class FollowupFlag extends Model
{
    /** @use HasFactory<\Database\Factories\FollowupFlagFactory> */
    use HasFactory, HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected function casts(): array
    {
        return [
            'flagged_date' => 'datetime',
        ];
    }

    /**
     * The request that triggered this flag.
     */
    public function request(): BelongsTo
    {
        return $this->belongsTo(ExcuseRequest::class, 'request_id');
    }

    /**
     * The program head this flag was escalated to.
     */
    public function escalatedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'escalated_to');
    }
}