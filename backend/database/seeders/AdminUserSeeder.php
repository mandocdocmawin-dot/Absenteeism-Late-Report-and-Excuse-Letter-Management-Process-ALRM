<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Program;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Simple value object for a single user to be seeded.
 */
final readonly class SeedUser
{
    public function __construct(
        public string $name,
        public string $email,
        public UserRole $role,
        /** @var string[] */
        public array $programIds = [],
    ) {}
}

enum UserRole: string
{
    case Administrator = 'administrator';
    case ProgramHead = 'program_head';
    case Instructor = 'instructor';
}

class AdminUserSeeder extends Seeder
{
    private const string APPROVED_STATUS = 'approved';

    /** Seed only the explicitly configured local accounts; no external roster. */
    public function run(): void
    {
        $allProgramIds = Program::query()
            ->where('program_name', '!=', 'General Education')
            ->pluck('id')->all();

        $manualUsers = [
            new SeedUser(
                name: 'Jade Riel Abuela',
                email: 'jaderiel.abuela@laverdad.edu.ph',
                role: UserRole::Administrator,
            ),
            new SeedUser(
                name: 'Marwin Mandocdoc',
                email: 'marwin.mandocdoc@student.laverdad.edu.ph',
                role: UserRole::Instructor,
                programIds: $allProgramIds,
            ),
            new SeedUser(
                name: 'Mac Robert Savandal',
                email: 'macrobert.savandal@student.laverdad.edu.ph',
                role: UserRole::Instructor,
                programIds: $allProgramIds,
            ),
            new SeedUser(
                name: 'Jimuel Jarina',
                email: 'jimueljarina@student.laverdad.edu.ph',
                role: UserRole::Instructor,
                programIds: $allProgramIds,
            ),
            new SeedUser(
                name: 'Rancel Joy Cuervo',
                email: 'ranceljoycuervo@student.laverdad.edu.ph',
                role: UserRole::Instructor,
                programIds: $allProgramIds,
            ),
        ];

        DB::transaction(function () use ($manualUsers) {
            foreach ($manualUsers as $user) {
                $this->saveUser($user);
            }
        });

        Log::info('AdminUserSeeder: local accounts seeded', ['count' => count($manualUsers)]);
    }

    private function saveUser(SeedUser $user): void
    {
        $model = User::query()->where('email', $user->email)->first();
        $isNew = $model === null;

        if ($isNew) {
            $model = new User(['email' => $user->email]);
        }

        $hasLoggedInWithGoogle = ! $isNew && $model->google_id !== null;
        $homeProgramId = in_array($user->email, DevInstructorClassSeeder::DEV_INSTRUCTOR_EMAILS, true)
            ? Program::query()->where('program_name', DevInstructorClassSeeder::DEV_HOME_PROGRAM_NAME)->firstOrFail()->id
            : ($user->programIds[0] ?? null);

        $model->forceFill([
            'name' => $hasLoggedInWithGoogle ? $model->name : $user->name,
            'role' => $user->role->value,
            'status' => self::APPROVED_STATUS,
            'deactivated_at' => null,
            'program_id' => $homeProgramId,
        ]);

        $model->save();
        $model->programs()->sync($user->programIds);
    }
}
