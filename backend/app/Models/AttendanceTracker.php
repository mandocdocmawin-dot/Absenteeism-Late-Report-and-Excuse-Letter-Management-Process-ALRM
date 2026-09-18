<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'enrollment_id',
    'total_lates',
    'total_absences',
    'converted_absences',
    'status',
    'warning_notified_at',
    'ir_notified_at',
])]
class AttendanceTracker extends Model
{
    /** @use HasFactory<\Database\Factories\AttendanceTrackerFactory> */
    use HasFactory, HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $table = 'attendance_tracker';


    /*
    |--------------------------------------------------------------------------
    | Casts
    |--------------------------------------------------------------------------
    */

    protected function casts(): array
    {
        return [
            'total_lates'          => 'integer',
            'total_absences'       => 'integer',
            'converted_absences'   => 'integer',
            'warning_notified_at'  => 'datetime',
            'ir_notified_at'       => 'datetime',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Business Logic
    |--------------------------------------------------------------------------
    */

    /**
     * Recompute converted_absences and update status.
     * Call this every time total_lates or total_absences changes.
     *
     * Policy: 3 lates = 1 absence
     * Triggers: 2 converted absences = warning, 3 = IR
     */
    public function recompute(): void
    {
        $this->converted_absences = $this->total_absences + (int) floor($this->total_lates / 3);

        $this->status = match (true) {
            $this->converted_absences >= 3 => 'IR',
            $this->converted_absences >= 2 => 'warning',
            default                         => 'safe',
        };

        $this->save();
    }
}