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

    /** Current attendance stage and percentage of total semester class hours. */
    public function attendanceRisk(): array
    {
        $enrollment = $this->request?->enrollment;
        $tracker = $enrollment?->attendanceTracker;

        if (! $tracker || ! $enrollment->class) {
            return ['threshold' => null, 'percentage' => null];
        }

        // Reuse the loaded enrollment without adding a circular serialized relation.
        $tracker = clone $tracker;
        $tracker->setRelation('enrollment', $enrollment);

        return [
            'threshold' => $tracker->status,
            'percentage' => $enrollment->class->totalSemesterHours() > 0
                ? $tracker->absencePercentage()
                : null,
        ];
    }
}
