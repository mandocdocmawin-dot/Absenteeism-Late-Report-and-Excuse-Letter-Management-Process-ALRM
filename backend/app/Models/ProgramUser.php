<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\Pivot;

class ProgramUser extends Pivot
{
    use HasUuids;

    protected $table = 'program_user';

    public $incrementing = false;

    protected $keyType = 'string';
}