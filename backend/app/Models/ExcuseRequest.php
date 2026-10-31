<?php

namespace App\Models;

use App\Observers\ExcuseRequestObserver;
use Database\Factories\ExcuseRequestFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\ObservedBy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[ObservedBy(ExcuseRequestObserver::class)]
#[Fillable([
    'enrollment_id',
    'type',
    'subjects_missed',
    'minutes_late',
    'start_date_of_absence',
    'end_date_of_absence',
    'reason',
    'evidence_file_url',
    'evidence_type',
    'proof_types',
    'status',
    'date_submitted',
    'date_reviewed',
    'reviewed_by',
])]
class ExcuseRequest extends Model
{
    public const PROOF_TYPES = [
        'Medical Certificate',
        'Prescription / Medical Record',
        'Death Certificate / Funeral Notice',
        'School Activity Endorsement',
        'Letter from Parent/Guardian',
        'Others',
    ];

    /** @use HasFactory<ExcuseRequestFactory> */
    use HasFactory, HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    // Actual table name is 'requests'
    protected $table = 'requests';

    protected function casts(): array
    {
        return [
            'class_snapshot' => 'array',
            'proof_types' => 'array',
            'start_date_of_absence' => 'date',
            'end_date_of_absence' => 'date',
            'date_submitted' => 'datetime',
            'date_reviewed' => 'datetime',
        ];
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

    public function teachingAssignment(): BelongsTo
    {
        return $this->belongsTo(TeachingAssignment::class);
    }

    public function scopeForInstructor(Builder $query, string $instructorId, bool $activeOnly = false): Builder
    {
        return $query->whereHas('teachingAssignment', function ($query) use ($instructorId, $activeOnly) {
            $query->where('instructor_id', $instructorId);
            if ($activeOnly) {
                $query->whereNull('ended_at');
            }
        });
    }

    /** Keep the existing response shape, but make request class details historical. */
    public function toArray(): array
    {
        $data = parent::toArray();
        if ($this->class_snapshot !== null && isset($data['enrollment']['class'])) {
            $data['enrollment']['class'] = $this->class_snapshot;
        }

        return $data;
    }

    public function historicalClass(): ?ClassModel
    {
        if ($this->class_snapshot === null) {
            return $this->enrollment?->class;
        }

        return (new ClassModel)->forceFill($this->class_snapshot);
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
