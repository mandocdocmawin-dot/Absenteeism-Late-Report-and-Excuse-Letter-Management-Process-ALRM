<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Program;
use App\Models\TrustedDevice;
use App\Models\User;
use App\Support\ExternalApiClient;
use Google\Client as GoogleClient;
use Google\Service\Sheets as GoogleSheets;
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
    /**
     * Google Sheet ID (from the URL, between /d/ and /edit).
     */
    private const string SPREADSHEET_ID = '19eJh4R3cWEL5T52-v86z8NVSVvS2MTtg0h99N69N8Qw';

    /**
     * Path to the service account credentials JSON when running locally,
     * relative to storage_path(). Not used on Render — see
     * RENDER_SECRET_CREDENTIALS_PATH and resolveCredentialsPath() below.
     */
    private const string CREDENTIALS_PATH = 'app/google/service-account.json';

    /**
     * Path to the service account credentials JSON on Render, where it's
     * mounted read-only from the "Secret Files" dashboard section. Render
     * exposes every secret file at /etc/secrets/<filename>.
     */
    private const string RENDER_SECRET_CREDENTIALS_PATH = '/etc/secrets/service-account.json';

    /**
     * Roles that are considered "managed by the Google Sheet". Any
     * existing user with one of these roles whose email no longer
     * appears in the sheet on a given run gets deactivated. Manual
     * entries (e.g. administrators) are never touched by this logic,
     * so keep manual-only roles (like Administrator) out of this list.
     */
    private const array SHEET_MANAGED_ROLES = [
        UserRole::ProgramHead->value,
        UserRole::Instructor->value,
    ];

    /**
     * Status value applied when a sheet-managed user disappears from
     * the sheet. Adjust to match whatever your `status` column actually
     * uses (check an existing deactivated row if you have one).
     */
    private const string DEACTIVATED_STATUS = 'deactivated';

    private const string APPROVED_STATUS = 'approved';

    /**
     * Maps each sheet tab name to a `program_name` in the database. We
     * don't hardcode a UUID here since program_id is random per
     * environment/seed run — the real ID is resolved at runtime via
     * Program::query()->firstWhere().
     *
     * A single instructor can appear in multiple tabs (e.g. BSIS + ACT +
     * BSA) — they're seeded as a member of every program whose tab they
     * appear in, via the program_user pivot table (see fetchInstructorsFromGoogleSheets()
     * and saveUser()).
     */
    private const array TAB_TO_PROGRAM_NAME = [
        'GEN ED' => 'General Education',
        'BSSW' => 'Bachelor of Science in Social Work',
        'BSA' => 'Bachelor of Science in Accountancy',
        'BSAIS' => 'Bachelor of Science in Accounting Information System',
        'BSIS' => 'Bachelor of Science in Information System',
        'ACT' => 'Associate in Computer Technology',
        'BAB' => 'Bachelor of Arts in Broadcasting',
    ];

    /**
     * Role priority, high to low. Used when the same email appears both
     * as a manual entry AND a sheet entry — the higher role wins (e.g.
     * an 'administrator' won't get downgraded to 'instructor' just
     * because they also show up in the Google Sheet of instructors).
     */
    private const array ROLE_PRIORITY = [
        UserRole::Administrator->value => 3,
        UserRole::ProgramHead->value => 2,
        UserRole::Instructor->value => 1,
    ];

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

        $sheet = $this->fetchInstructorsFromGoogleSheets();
        $sheetUsers = $sheet['users'];
        $failedTabs = $sheet['failedTabs'];
        $sheetTrusted = $failedTabs === [] && $sheetUsers !== [];

        if (! $sheetTrusted) {
            $message = 'AdminUserSeeder: Google Sheet could not be fully read. '
                .'Seeding manual users only; no sheet user was created, updated or deactivated, '
                .'and no program head was changed.';

            Log::error($message, ['failed_tabs' => $failedTabs, 'sheet_users_found' => count($sheetUsers)]);
            $this->command?->error($message.' Failed: '.($failedTabs === [] ? '(sheet returned no users)' : implode(', ', $failedTabs)));

            $sheetUsers = [];
        }

        $sheetEmails = array_map(fn (SeedUser $u) => $u->email, $sheetUsers);

        $manualEmails = array_map(fn (SeedUser $u) => $u->email, $manualUsers);

        $merged = [];

        foreach ([...$manualUsers, ...$sheetUsers] as $user) {
            $existing = $merged[$user->email] ?? null;

            if (! $existing) {
                $merged[$user->email] = $user;

                continue;
            }

            $existingPriority = self::ROLE_PRIORITY[$existing->role->value];
            $incomingPriority = self::ROLE_PRIORITY[$user->role->value];

            $mergedProgramIds = array_values(array_unique([
                ...$existing->programIds,
                ...$user->programIds,
            ]));

            $merged[$user->email] = new SeedUser(
                name: $incomingPriority > $existingPriority ? $user->name : $existing->name,
                email: $existing->email,
                role: $incomingPriority > $existingPriority ? $user->role : $existing->role,
                programIds: $mergedProgramIds,
            );
        }

        DB::transaction(function () use ($merged, $sheetEmails, $manualEmails, $sheetTrusted) {
            $created = [];
            $updated = [];

            foreach ($merged as $user) {
                $wasNew = ! User::query()->where('email', $user->email)->exists();
                $this->saveUser($user);
                $wasNew ? $created[] = $user->email : $updated[] = $user->email;
            }

            $deactivated = [];

            if ($sheetTrusted) {
                $this->syncProgramHeads($merged);

                $deactivated = $this->deactivateMissingSheetUsers($sheetEmails, $manualEmails);
            }

            Log::info('AdminUserSeeder: run summary', [
                'sheet_trusted' => $sheetTrusted,
                'created' => $created,
                'updated' => $updated,
                'deactivated' => $deactivated,
            ]);
        });
    }

    /**
     * Resolves the service account credentials path. On Render, the file
     * is mounted read-only at RENDER_SECRET_CREDENTIALS_PATH via the
     * "Secret Files" dashboard section, so we use that when it exists.
     * Locally (or on any other host), we fall back to the file checked
     * into storage/app/google/ (gitignored).
     */
    private function resolveCredentialsPath(): string
    {
        if (file_exists(self::RENDER_SECRET_CREDENTIALS_PATH)) {
            return self::RENDER_SECRET_CREDENTIALS_PATH;
        }

        return storage_path(self::CREDENTIALS_PATH);
    }

    private function resolveCredentials(): string|array
    {
        $json = env('GOOGLE_SERVICE_ACCOUNT_JSON');

        if ($json) {
            $decoded = json_decode($json, true);

            if (json_last_error() === JSON_ERROR_NONE) {
                return $decoded;
            }

            Log::warning('GOOGLE_SERVICE_ACCOUNT_JSON env var is set but is not valid JSON — falling back to file path.');
        }

        return $this->resolveCredentialsPath();
    }

    /**
     * @return array{users: SeedUser[], failedTabs: string[]}
     */
    private function fetchInstructorsFromGoogleSheets(): array
    {
        $failedTabs = [];

        try {
            $client = new GoogleClient;
            $client->setHttpClient(ExternalApiClient::make());
            $client->setApplicationName('AdminUserSeeder');
            $client->setScopes([GoogleSheets::SPREADSHEETS_READONLY]);
            $client->setAuthConfig($this->resolveCredentials());

            $service = new GoogleSheets($client);
        } catch (\Throwable $e) {
            Log::error("AdminUserSeeder: could not set up the Google client: {$e->getMessage()}");

            return ['users' => [], 'failedTabs' => ['(google client setup)']];
        }

        /** @var array<string, array{name: string, role: UserRole, programIds: array<string>}> */
        $byEmail = [];

        foreach (self::TAB_TO_PROGRAM_NAME as $tabName => $programName) {
            $programId = Program::query()->firstWhere('program_name', $programName)?->id;

            if ($programId === null) {
                Log::warning("AdminUserSeeder: no program found with name '{$programName}' (tab: {$tabName}).");
            }

            try {
                $range = "'{$tabName}'!A2:C10001";
                $response = $service->spreadsheets_values->get(self::SPREADSHEET_ID, $range);

                $rows = $response->getValues() ?? [];
                if (count($rows) >= 10000) {
                    throw new \RuntimeException('Roster exceeds the reviewed row limit.');
                }
                foreach ($rows as $row) {
                    $roleLabel = trim($row[0] ?? '');
                    $name = trim($row[1] ?? '');
                    $email = strtolower(trim($row[2] ?? ''));

                    if ($name === '' || mb_strlen($name) > 255 || strlen($email) > 255
                        || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                        continue;
                    }

                    if (! $this->hasAllowedDomain($email)) {
                        Log::warning("AdminUserSeeder: skipped '{$email}' (tab: {$tabName}) — not a staff-domain address.");

                        continue;
                    }

                    $role = strcasecmp($roleLabel, 'Program Head') === 0
                        ? UserRole::ProgramHead
                        : UserRole::Instructor;

                    if (! isset($byEmail[$email])) {
                        $byEmail[$email] = [
                            'name' => $name,
                            'role' => $role,
                            'programIds' => [],
                        ];
                    }

                    if (self::ROLE_PRIORITY[$role->value] > self::ROLE_PRIORITY[$byEmail[$email]['role']->value]) {
                        $byEmail[$email]['role'] = $role;
                    }

                    if ($programId !== null) {
                        $byEmail[$email]['programIds'][] = $programId;
                    }
                }
            } catch (\Throwable $e) {
                $failedTabs[] = $tabName;

                Log::warning("AdminUserSeeder: failed to fetch tab '{$tabName}': {$e->getMessage()}");
            }
        }

        $users = array_map(
            fn (string $email, array $data) => new SeedUser(
                name: $data['name'],
                email: $email,
                role: $data['role'],
                programIds: array_values(array_unique($data['programIds'])),
            ),
            array_keys($byEmail),
            $byEmail,
        );

        return ['users' => $users, 'failedTabs' => $failedTabs];
    }

    /**
     * Sheet entries must be on the STAFF domain. A student-domain address
     * in the sheet would otherwise be seeded as an instructor. Dev
     * accounts on a student domain are handled separately through
     * SEED_DEV_INSTRUCTOR_EMAILS and never go through this check.
     */
    private function hasAllowedDomain(string $email): bool
    {
        $domain = substr(strrchr($email, '@') ?: '', 1);
        $staffDomain = strtolower((string) config('institution.staff_domain'));

        return $staffDomain !== '' && $domain === $staffDomain;
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

    private function syncProgramHeads(array $merged): void
    {
        $headByProgram = [];

        foreach ($merged as $user) {
            if ($user->role !== UserRole::ProgramHead) {
                continue;
            }

            $model = User::query()->where('email', $user->email)->first();

            if ($model === null) {
                continue;
            }

            foreach ($user->programIds as $programId) {
                $headByProgram[$programId] = $model->id;
            }
        }

        foreach (self::TAB_TO_PROGRAM_NAME as $programName) {
            $program = Program::query()->firstWhere('program_name', $programName);

            if ($program === null) {
                continue;
            }

            $program->forceFill([
                'program_head_id' => $headByProgram[$program->id] ?? null,
            ])->save();
        }
    }

    /**
     * Deactivates any existing sheet-managed user (instructor / program
     * head) whose email is no longer present in the sheet. Manual
     * entries and any role outside SHEET_MANAGED_ROLES are never touched.
     *
     * Only STAFF-domain emails are considered, because the sheet can only
     * ever contain staff-domain emails (see hasAllowedDomain()). A
     * student-domain instructor (dev/test account) was never managed by
     * the sheet, so it is never deactivated by it, with no config needed.
     *
     * Deactivated users also lose their API tokens and trusted devices, so
     * an old token stops working immediately. Returns the list of emails
     * that were deactivated, for logging.
     *
     * Only call this when the sheet was read completely (see run()).
     *
     * @param  string[]  $sheetEmails
     * @param  string[]  $manualEmails
     * @return string[]
     */
    private function deactivateMissingSheetUsers(array $sheetEmails, array $manualEmails): array
    {
        $staffDomain = strtolower((string) config('institution.staff_domain'));
        if ($staffDomain === '') {
            return [];
        }

        $toDeactivate = User::query()
            ->whereIn('role', self::SHEET_MANAGED_ROLES)
            ->where('email', 'like', '%@'.$staffDomain)
            ->whereNotIn('email', $sheetEmails)
            ->whereNotIn('email', $manualEmails)
            ->where('status', '!=', self::DEACTIVATED_STATUS)
            ->get();

        foreach ($toDeactivate as $user) {
            $user->forceFill([
                'status' => self::DEACTIVATED_STATUS,
                'deactivated_at' => now(),
            ])->save();

            $user->tokens()->delete();
            TrustedDevice::where('user_id', $user->id)->delete();
        }

        return $toDeactivate->pluck('email')->all();
    }
}
