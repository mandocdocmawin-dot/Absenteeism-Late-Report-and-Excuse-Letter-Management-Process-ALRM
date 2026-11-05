<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class ProgramFactory extends Factory
{
    public function definition(): array
    {
        return [
            'program_name' => $this->faker->unique()->randomElement([
                'BS Information Technology', 'BS Computer Science', 'BS Accountancy', 'BS Nursing',
            ]) . ' ' . $this->faker->randomNumber(4),
            'program_head_id' => null,
        ];
    }
}