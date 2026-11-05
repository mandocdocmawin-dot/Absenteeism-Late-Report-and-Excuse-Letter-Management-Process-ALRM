<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', User::class) ?? false;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => strtolower(trim($this->input('email')))]);
        }

        if (! $this->filled('name') && $this->filled('first_name') && $this->filled('last_name')) {
            $parts = [$this->input('first_name'), $this->input('middle_name'), $this->input('last_name')];
            if (collect($parts)->every(fn ($part) => $part === null || is_string($part))) {
                $this->merge(['name' => implode(' ', array_filter(array_map(
                    fn ($part) => trim($part ?? ''), $parts,
                ), fn ($part) => $part !== ''))]);
            }
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'first_name' => ['required_with:middle_name,last_name', 'nullable', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['required_with:first_name,middle_name', 'nullable', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'role' => ['required', 'string', Rule::in(['student', 'instructor', 'program_head', 'administrator'])],
            'program_id' => [Rule::prohibitedIf($this->input('role') === 'administrator'), 'nullable', 'uuid', 'exists:programs,id'],
            'school_id_number' => ['nullable', 'string', 'max:50', Rule::unique('users', 'school_id_number')],
            // Year is collected during completion, which also enrolls the student.
            'year_level' => ['prohibited'],
        ];
    }
}
