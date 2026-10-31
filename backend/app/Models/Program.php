<?php

namespace App\Models;

use Database\Factories\ProgramFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['program_name', 'program_head_id'])]
class Program extends Model
{
    /** @use HasFactory<ProgramFactory> */
    use HasFactory, HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

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

    /** Active primary heads, explicit co-heads, and heads of their current program. */
    public function notificationHeads()
    {
        return User::where('status', 'approved')->where(function ($query) {
            $query->where('id', $this->program_head_id)
                ->orWhereHas('additionalHeadedPrograms', fn ($query) => $query->where('programs.id', $this->id))
                ->orWhere(fn ($query) => $query->where('role', 'program_head')->where('program_id', $this->id));
        })->get();
    }

    /**
     * All classes under this program.
     */
    public function classes(): HasMany
    {
        return $this->hasMany(ClassModel::class, 'program_id');
    }

    public function curricula(): HasMany
    {
        return $this->hasMany(Curriculum::class);
    }

    /**
     * All users (instructors/program heads) belonging to this program.
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'program_user')
            ->using(ProgramUser::class)
            ->withTimestamps();
    }
}
