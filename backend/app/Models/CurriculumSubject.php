<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['curriculum_id', 'year_level', 'semester', 'code', 'subject_name', 'credit_units', 'lecture_units', 'laboratory_units', 'units_text', 'source'])]
class CurriculumSubject extends Model
{
    use HasUuids;

    protected $casts = ['source' => 'array', 'credit_units' => 'float', 'lecture_units' => 'float', 'laboratory_units' => 'float'];

    public function curriculum(): BelongsTo
    {
        return $this->belongsTo(Curriculum::class);
    }
}
