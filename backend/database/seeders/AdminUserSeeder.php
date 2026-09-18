<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $users = [
            [
                'name' => 'Jade Riel Abuela',
                'email' => 'jaderiel.abuela@laverdad.edu.ph',
                'role' => 'administrator',
                'program_id' => null,
            ],
            // [
            //     'name' => '', // pangalan ng program head
            //     'email' => '', // email ng program head (@laverdad.edu.ph)
            //     'role' => 'program_head',
            //     'program_id' => null, // ID ng program niya, kung meron ka nang na-seed
            // ],
            // [
            //     'name' => '', // pangalan ng instructor
            //     'email' => '', // email ng instructor (@laverdad.edu.ph)
            //     'role' => 'instructor',
            //     'program_id' => null,
            // ],
        ];

        foreach ($users as $data) {
            User::firstOrCreate(
                ['email' => $data['email']],
                ['name' => $data['name']]
            )->forceFill([
                'role' => $data['role'],
                'status' => 'approved',
                'program_id' => $data['program_id'],
            ])->save();
        }
    }
}