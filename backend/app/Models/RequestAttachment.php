<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'excuse_request_id',
    'original_name',
    'mime_type',
    'size',
    'data',
])]
// Para hindi mapasama ang binary sa JSON kahit saan
#[Hidden(['data'])]
class RequestAttachment extends Model
{
    use HasFactory, HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    /**
     * The student who uploaded this attachment.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The request this attachment is linked to.
     * NULL pa habang na-upload na pero hindi pa na-submit ang request.
     */
    public function excuseRequest(): BelongsTo
    {
        return $this->belongsTo(ExcuseRequest::class, 'excuse_request_id');
    }
}