<?php

namespace Database\Factories;

use App\Models\Enrollment;
use Illuminate\Database\Eloquent\Factories\Factory;

class ExcuseRequestFactory extends Factory
{
    public function definition(): array
    {
        return [
            'enrollment_id'         => Enrollment::factory(),
            'type'                  => $this->faker->randomElement(['absence', 'late']),
            'start_date_of_absence' => now()->subDays(3)->toDateString(),
            'end_date_of_absence'   => null,
            'reason'                => $this->faker->sentence(),
            'evidence_file_url'     => null,
            'evidence_type'         => null,
            'status'                => 'pending',
            'date_submitted'        => now(),
            'date_reviewed'         => null,
            'reviewed_by'           => null,
        ];
    }
}