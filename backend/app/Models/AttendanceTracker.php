<?php

namespace App\Models;

use Database\Factories\AttendanceTrackerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'enrollment_id',
    'total_lates',
    'total_absences',
    'absence_hours',
    'converted_absences',
    'status',
    'warning_notified_at',
    'critical_notified_at',
    'ir_notified_at',
])]
class AttendanceTracker extends Model
{
    /** @use HasFactory<AttendanceTrackerFactory> */
    use HasFactory, HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $table = 'attendance_tracker';

    protected function casts(): array
    {
        return [
            'total_lates' => 'integer',
            'total_absences' => 'integer',
            'absence_hours' => 'float',
            'converted_absences' => 'integer',
            'warning_notified_at' => 'datetime',
            'critical_notified_at' => 'datetime',
            'ir_notified_at' => 'datetime',
        ];
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

    /** Absences use meeting hours; each complete group of 3 lates adds 1 hour. */
    public function unitsUsed(): float
    {
        return round(
            ($this->absence_hours ?? $this->total_absences * $this->enrollment->class->unitsPerMeeting())
                + floor($this->total_lates / 3),
            2
        );
    }

    /** Allowable absence units ng class (20% ng total hours). */
    public function allowedUnits(): float
    {
        return $this->enrollment->class->allowedAbsenceUnits();
    }

    /** Ginagamit para hanapin ang subject na pinakamalapit sa limit. */
    public function usageRatio(): float
    {
        $allowed = $this->allowedUnits();

        return $allowed > 0 ? $this->unitsUsed() / $allowed : 0;
    }

    /** Percentage of total semester class hours, not of the 20% allowance. */
    public function absencePercentage(): float
    {
        $total = $this->enrollment->class->totalSemesterHours();

        return $total > 0 ? round($this->unitsUsed() / $total * 100, 2) : 0;
    }

    public function remainingSemesterPercentage(): float
    {
        $total = $this->enrollment->class->totalSemesterHours();

        $remainingHours = max(0, round($this->allowedUnits() - $this->unitsUsed(), 2));

        return $total > 0 ? round($remainingHours / $total * 100, 2) : 0;
    }

    /**
     * Policy: 3 lates = 1 absent hour.
     * warning → one week's class hours; critical → two weeks, with consultation.
     * IR → allowable absence limit reached (20%, rounded up to a whole hour).
     * Tawagin tuwing nagbabago ang total_lates o total_absences.
     */
    public function recompute(): void
    {
        $this->converted_absences = $this->total_absences + (int) floor($this->total_lates / 3);

        $class = $this->enrollment->class;
        $total = $class->totalSemesterHours();
        $used = $this->unitsUsed();

        $this->status = match (true) {
            $total <= 0 => 'safe',
            $used >= $class->allowedAbsenceUnits() => 'IR',
            $used >= $class->criticalAbsenceUnits() => 'critical',
            $used >= $class->preventiveAbsenceUnits() => 'warning',
            default => 'safe',
        };

        $this->save();
    }
}
