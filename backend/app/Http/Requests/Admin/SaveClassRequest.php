<?php

namespace App\Http\Requests\Admin;

use App\Models\ClassModel;
use App\Models\CurriculumSubject;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SaveClassRequest extends FormRequest
{
    public function authorize(): bool
    {
        $class = $this->route('class');

        return $this->user()?->can($class instanceof ClassModel ? 'update' : 'create', $class ?? ClassModel::class) ?? false;
    }

    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';
        $rules = [
            'subject_name' => [$required, 'string', 'max:255'],
            'section' => [$required, 'string', 'max:50'],
            'instructor_id' => $this->isMethod('post')
                ? ['sometimes', 'nullable', 'uuid', Rule::exists('users', 'id')->where('role', 'instructor')->where('status', 'approved')]
                : ['missing'],
            'program_id' => [$required, 'uuid', 'exists:programs,id'],
            'year_level' => [$required, Rule::in(['1st', '2nd', '3rd', '4th'])],
            'semester' => [$required, Rule::in(['1st', '2nd'])],
            'school_year' => [$required, 'string', 'regex:/^\d{4}-\d{4}$/'],
            'curriculum_subject_id' => ['sometimes', 'nullable', 'uuid', 'exists:curriculum_subjects,id'],
            'credit_units' => ['sometimes', 'nullable', 'numeric', 'between:0,100'],
            'weekly_hours' => ['sometimes', 'numeric', 'gt:0', 'max:168'],
            'meetings_per_week' => ['sometimes', 'integer', 'between:1,42'],
            'schedule' => ['sometimes', 'nullable'],
        ];
        if (is_array($this->input('schedule'))) {
            $rules += [
                'schedule' => ['array', 'list', 'max:42'],
                'schedule.*' => ['required', 'array:day,start,end,room'],
                'schedule.*.day' => ['required', Rule::in(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])],
                'schedule.*.start' => ['required', 'date_format:H:i'],
                'schedule.*.end' => ['required', 'date_format:H:i', 'after:schedule.*.start'],
                'schedule.*.room' => ['sometimes', 'nullable', 'string', 'max:100'],
            ];
            $rules['schedule'] = ['array', 'list', 'max:42'];
        } elseif ($this->input('schedule') !== null) {
            $rules['schedule'] = ['string', 'max:4096'];
        }

        return $rules;
    }

    public function classAttributes(): array
    {
        $data = $this->validated();
        $class = $this->route('class');
        $schedule = $data['schedule'] ?? ($class?->schedule ?? []);
        if (is_array($schedule) && $schedule !== []) {
            $minutes = 0;
            foreach ($schedule as $index => $slot) {
                $duration = $this->minutes($slot['end']) - $this->minutes($slot['start']);
                if ($duration <= 0) {
                    throw ValidationException::withMessages(['schedule' => 'Each meeting must end after its start on the same day.']);
                }
                foreach (array_slice($schedule, 0, $index) as $other) {
                    if ($slot['day'] === $other['day'] && $slot['start'] < $other['end'] && $other['start'] < $slot['end']) {
                        throw ValidationException::withMessages(['schedule' => 'Meetings for this class cannot overlap.']);
                    }
                }
                $minutes += $duration;
            }
            $hours = round($minutes / 60, 2);
            if ($hours > 168) {
                throw ValidationException::withMessages(['schedule' => 'Weekly meeting hours cannot exceed 168.']);
            }
            if ((isset($data['weekly_hours']) && abs((float) $data['weekly_hours'] - $hours) > 0.005)
                || (isset($data['meetings_per_week']) && (int) $data['meetings_per_week'] !== count($schedule))) {
                throw ValidationException::withMessages(['schedule' => 'Hours and meeting count must agree with the supplied schedule.']);
            }
            $data['weekly_hours'] = $hours;
            $data['meetings_per_week'] = count($schedule);
        } elseif (! $class && (! isset($data['weekly_hours']) || ! isset($data['meetings_per_week']))) {
            throw ValidationException::withMessages(['weekly_hours' => 'Supply confirmed weekly_hours and meetings_per_week when meeting times are not yet set.']);
        }

        $data['schedule'] = $schedule;
        $subjectId = array_key_exists('curriculum_subject_id', $data) ? $data['curriculum_subject_id'] : $class?->curriculum_subject_id;
        if ($subjectId) {
            $subject = CurriculumSubject::with('curriculum')->findOrFail($subjectId);
            foreach (['program_id' => $subject->curriculum->program_id, 'year_level' => $subject->year_level, 'semester' => $subject->semester] as $field => $expected) {
                if (($data[$field] ?? $class?->$field) !== $expected) {
                    throw ValidationException::withMessages(['curriculum_subject_id' => 'The selected subject must match the class program, year level, and semester.']);
                }
            }
            $data['credit_units'] = $subject->credit_units;
        }

        return $data;
    }

    private function minutes(string $time): int
    {
        [$hours, $minutes] = array_map('intval', explode(':', $time));

        return $hours * 60 + $minutes;
    }
}
