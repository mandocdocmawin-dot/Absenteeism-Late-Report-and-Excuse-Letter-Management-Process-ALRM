<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['curriculum_id', 'school_year', 'year_level', 'semester', 'code', 'subject_name', 'credit_units', 'units_text', 'source'])]
class ProgramOffering extends Model
{
    use HasUuids;

    protected $casts = ['source' => 'array', 'credit_units' => 'float'];

    public function curriculum(): BelongsTo
    {
        return $this->belongsTo(Curriculum::class);
    }
}
