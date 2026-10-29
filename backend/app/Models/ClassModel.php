<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\ClassModelFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Validation\ValidationException;

#[Fillable(['subject_name', 'instructor_id', 'schedule', 'program_id', 'year_level', 'section', 'semester', 'school_year', 'curriculum_subject_id', 'credit_units', 'weekly_hours', 'meetings_per_week'])]
class ClassModel extends Model
{
    /** @use HasFactory<ClassModelFactory> */
    use HasFactory, HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    // 'class' is a reserved word in PHP — table name must be explicit
    protected $table = 'classes';

    protected $attributes = ['assignment_revision' => 0];

    protected $casts = [
        'assignment_revision' => 'integer',
        'schedule' => 'array',
        'meetings_per_week' => 'integer',
        'credit_units' => 'float',
    ];

    protected static function booted(): void
    {
        static::created(function (self $class) {
            if ($class->instructor_id) {
                $class->forceFill(['assignment_revision' => 1])->saveQuietly();
                TeachingAssignment::create([
                    'class_id' => $class->id, 'instructor_id' => $class->instructor_id,
                    'version' => 1, 'started_at' => now(),
                ]);
            }
        });
        static::updating(function (self $class) {
            if ($class->isDirty('instructor_id')) {
                throw ValidationException::withMessages([
                    'instructor_id' => 'Use the teaching assignment action to change or remove an instructor.',
                ]);
            }
        });
    }

    public function teachingAssignments(): HasMany
    {
        return $this->hasMany(TeachingAssignment::class, 'class_id');
    }

    public function activeTeachingAssignment(): HasOne
    {
        return $this->hasOne(TeachingAssignment::class, 'class_id')->whereNull('ended_at');
    }

    public function requests(): HasManyThrough
    {
        return $this->hasManyThrough(ExcuseRequest::class, Enrollment::class, 'class_id', 'enrollment_id');
    }

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    /**
     * The instructor who teaches this class.
     */
    public function instructor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'instructor_id');
    }

    /**
     * The program this class belongs to.
     */
    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function curriculumSubject(): BelongsTo
    {
        return $this->belongsTo(CurriculumSubject::class);
    }

    /**
     * All enrollments in this class.
     */
    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class, 'class_id');
    }

    /** Units (hours) ng 1 absence = oras ng isang meeting. */
    public function unitsPerMeeting(): float
    {
        return $this->weekly_hours / max(1, $this->meetings_per_week);
    }

    /** Scheduled hours actually missed; credit units never determine contact hours. */
    public function absenceHoursForPeriod(?CarbonInterface $start, ?CarbonInterface $end = null): float
    {
        if (! $start || ! is_array($this->schedule) || $this->schedule === []) {
            return $this->unitsPerMeeting();
        }
        $byDay = [];
        foreach ($this->schedule as $slot) {
            if (! is_array($slot) || ! isset($slot['day'], $slot['start'], $slot['end'])
                || ! preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $slot['start'])
                || ! preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $slot['end'])) {
                return $this->unitsPerMeeting();
            }
            [$sh, $sm] = array_map('intval', explode(':', $slot['start']));
            [$eh, $em] = array_map('intval', explode(':', $slot['end']));
            $byDay[$slot['day']] = ($byDay[$slot['day']] ?? 0) + max(0, ($eh * 60 + $em) - ($sh * 60 + $sm));
        }
        $start = $start->copy()->startOfDay();
        $end = ($end ?? $start)->copy()->startOfDay();
        if ($end->lt($start)) {
            return 0.0;
        }
        $days = (int) $start->diffInDays($end) + 1;
        $minutes = intdiv($days, 7) * array_sum($byDay);
        for ($day = 0; $day < $days % 7; $day++) {
            $minutes += $byDay[$start->copy()->addDays($day)->format('D')] ?? 0;
        }

        return round($minutes / 60, 2);
    }

    public function totalSemesterHours(): float
    {
        return $this->weekly_hours * config('alrm.semester_weeks');
    }

    public function preventiveAbsenceUnits(): float
    {
        return round($this->weekly_hours * config('alrm.preventive_absence_weeks'), 2);
    }

    public function criticalAbsenceUnits(): float
    {
        return round($this->weekly_hours * config('alrm.critical_absence_weeks'), 2);
    }

    /** 20% of semester hours; round up the limit for 3-hour weekly subjects. */
    public function allowedAbsenceUnits(): float
    {
        $limit = round(
            $this->totalSemesterHours() * config('alrm.absence_limit_rate'),
            2
        );

        return (float) $this->weekly_hours === 3.0 ? ceil($limit) : $limit;
    }
}
