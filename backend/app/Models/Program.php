<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['program_name', 'program_head_id'])]
class Program extends Model
{
    /** @use HasFactory<\Database\Factories\ProgramFactory> */
    use HasFactory;

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    /**
     * The user who heads this program.
     */
    public function programHead(): BelongsTo
    {
        return $this->belongsTo(User::class, 'program_head_id');
    }

    /**
     * All classes under this program.
     */
    public function classes(): HasMany
    {
        return $this->hasMany(ClassModel::class, 'program_id');
    }

    /**
     * All users (students/instructors) belonging to this program.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'program_id');
    }
}