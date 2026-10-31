<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['class_id', 'instructor_id', 'version', 'started_at', 'ended_at'])]
class TeachingAssignment extends Model
{
    use HasUuids;

    protected $hidden = ['active_class_id'];

    protected static function booted(): void
    {
        static::updating(function (self $assignment) {
            if ($assignment->isDirty(['class_id', 'instructor_id', 'version', 'started_at'])
                || ($assignment->isDirty('ended_at') && $assignment->getOriginal('ended_at') !== null)) {
                throw new \LogicException('Teaching assignment identity is immutable; create a replacement instead.');
            }
        });
    }

    protected function casts(): array
    {
        return ['version' => 'integer', 'started_at' => 'datetime', 'ended_at' => 'datetime'];
    }

    public function class(): BelongsTo
    {
        return $this->belongsTo(ClassModel::class, 'class_id');
    }

    public function instructor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'instructor_id');
    }

    public function requests(): HasMany
    {
        return $this->hasMany(ExcuseRequest::class);
    }
}
