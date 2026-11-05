<?php

namespace Database\Seeders;

use App\Models\ClassModel;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/** Explicitly invoked test data; never part of the production roster sync. */
class DevInstructorScheduleSeeder extends Seeder
{
    public function run(): void
    {
        $users = User::whereIn('email', DevInstructorClassSeeder::DEV_INSTRUCTOR_EMAILS)->get()->keyBy('id');
        $classes = ClassModel::whereIn('instructor_id', $users->keys())->get();
        $groups = $classes->groupBy(fn ($class) => implode('|', [
            $class->program_id, $class->year_level, $class->section, $class->semester, $class->school_year,
        ]))->sortKeys()->values();
        if ($groups->count() > 24) {
            throw new RuntimeException('Sample timetable supports at most 24 sections. No schedules changed.');
        }

        $days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        $times = [['07:00', '10:00'], ['10:00', '13:00'], ['13:00', '16:00'], ['16:00', '19:00']];
        $changed = DB::transaction(function () use ($groups, $users, $days, $times): int {
            $changed = 0;
            foreach ($groups as $index => $group) {
                foreach ($group as $class) {
                    if ($class->schedule !== [] && $class->schedule !== null) {
                        continue;
                    }
                    $instructorIndex = array_search($users[$class->instructor_id]->email, DevInstructorClassSeeder::DEV_INSTRUCTOR_EMAILS, true);
                    $slot = ($index + $instructorIndex * 6) % 24;
                    [$start, $end] = $times[$slot % 4];
                    $class->schedule = [[
                        'day' => $days[intdiv($slot, 4)], 'start' => $start, 'end' => $end,
                        'room' => 'TEST-'.($instructorIndex + 1),
                    ]];
                    $class->forceFill(['weekly_hours' => 3, 'meetings_per_week' => 1])->save();
                    $changed++;
                }
            }

            return $changed;
        });

        $this->command?->info("Sample schedules filled: {$changed}. TEST rooms indicate test data, not official timetables.");
    }
}
