<?php

namespace Database\Factories;

use App\Models\Program;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ClassModelFactory extends Factory
{
    public function definition(): array
    {
        return [
            'subject_name'  => $this->faker->randomElement(['Data Structures', 'Calculus 1', 'Networking', 'Auditing']),
            'instructor_id' => User::factory()->state(['role' => 'instructor']),
            'schedule'      => $this->faker->randomElement(['MWF 8:00-9:00AM', 'TTH 1:00-2:30PM']),
            'program_id'    => Program::factory(),
        ];
    }
}