<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    private bool $authenticatedExchange = false;

    public static function forExchange($user): self
    {
        $resource = new self($user);
        $resource->authenticatedExchange = true;

        return $resource;
    }

    public function toArray(Request $request): array
    {
        $fields = ['id', 'name', 'email', 'role', 'program_id', 'school_id_number',
            'status', 'year_level'];
        if ($this->authenticatedExchange || $request->user()?->id === $this->id || $request->user()?->role === 'administrator') {
            $fields = [...$fields, 'guardian_name', 'contact_number'];
        }

        $headsProgram = count($this->resource->headedProgramIds()) > 0;

        return $this->resource->only($fields) + [
            'email_notifications_enabled' => $this->when(
                $this->authenticatedExchange || $request->user()?->id === $this->id,
                $this->email_notifications_enabled,
            ),
            'heads_program' => $headsProgram,
            'headed_program_exists' => $headsProgram,
            'program' => $this->whenLoaded('program'),
            'programs' => $this->whenLoaded('programs'),
        ];
    }
}
