<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'enrollment_id',
    'type',
    'start_date_of_absence',
    'end_date_of_absence',
    'reason',
    'evidence_file_url',
    'evidence_type',
    'status',
    'date_submitted',
    'date_reviewed',
    'reviewed_by',
])]
class ExcuseRequest extends Model
{
    /** @use HasFactory<\Database\Factories\ExcuseRequestFactory> */
    use HasFactory, HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    // Actual table name is 'requests'
    protected $table = 'requests';

    protected function casts(): array
    {
        return [
            'start_date_of_absence' => 'date',
            'end_date_of_absence'   => 'date',
            'date_submitted'        => 'datetime',
            'date_reviewed'         => 'datetime',
        ];
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function followupFlag(): HasOne
    {
        return $this->hasOne(FollowupFlag::class, 'request_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(UserNotification::class, 'request_id');
    }
}