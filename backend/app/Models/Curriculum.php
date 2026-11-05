<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['program_id', 'version', 'revision', 'sources'])]
class Curriculum extends Model
{
    use HasUuids;

    protected $casts = ['sources' => 'array'];

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function subjects(): HasMany
    {
        return $this->hasMany(CurriculumSubject::class);
    }

    public function offerings(): HasMany
    {
        return $this->hasMany(ProgramOffering::class);
    }
}
