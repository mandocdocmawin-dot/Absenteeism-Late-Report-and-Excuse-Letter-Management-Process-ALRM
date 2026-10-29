<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\ClassModel;
use App\Models\Program;
use App\Models\User;
use App\Services\TeachingAssignmentService;
use App\Support\ExternalApiClient;
use Google\Client as GoogleClient;
use Google\Service\Sheets as GoogleSheets;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Log;

final readonly class MeetingSlot
{
    public function __construct(
        public string $day,
        public string $start,
        public string $end,
        public ?string $room,
    ) {}

    /** @return array{day: string, start: string, end: string, room: string|null} */
    public function toArray(): array
    {
        return [
            'day' => $this->day,
            'start' => $this->start,
            'end' => $this->end,
            'room' => $this->room,
        ];
    }
}

final class ParsedClass
{
    /** @var MeetingSlot[] */
    public array $slots = [];

    public ?string $instructorName = null;

    public function __construct(
        public readonly string $subjectName,
        public readonly string $programName,
        public readonly string $programAbbreviation,
        public readonly string $yearLevel,
        public readonly string $semester,
        public readonly string $schoolYear,
    ) {}

    public function key(): string
    {
        return implode('|', [
            $this->programName,
            $this->yearLevel,
            $this->semester,
            $this->schoolYear,
            mb_strtolower($this->subjectName),
        ]);
    }
}

class ClassSeeder extends Seeder
{
    private const string SPREADSHEET_ID = '1K2ZHj-hkHKffwbKqdbeza_ZPj77K8uBZZWtOO7pYEFA';

    private const string CREDENTIALS_PATH = 'app/google/service-account.json';

    private const string RENDER_SECRET_CREDENTIALS_PATH = '/etc/secrets/service-account.json';

    private const array TAB_TO_PROGRAM_NAME = [
        'BSIS' => 'Bachelor of Science in Information System',
        'ACT' => 'Associate in Computer Technology',
        'BSA' => 'Bachelor of Science in Accountancy',
        'BSAIS' => 'Bachelor of Science in Accounting Information System',
        'BAB' => 'Bachelor of Arts in Broadcasting',
        'BSSW' => 'Bachelor of Science in Social Work',
    ];

    private const array DAY_COLUMNS = [
        1 => 'Mon',
        2 => 'Tue',
        3 => 'Wed',
        4 => 'Thu',
        5 => 'Fri',
        6 => 'Sat',
    ];

    private const array SKIP_KEYWORDS = [
        'weekly clean-up',
        'dedicated time for',
        'program meetings',
        'student activity program',
    ];

    private const array HONORIFIC_PREFIXES = [
        'Mr.',
        'Ms.',
        'Mrs.',
        'Dr.',
        'Engr.',
        'Atty.',
        'Prof.',
        'Fr.',
        'Sr.',
    ];

    private const float FUZZY_MATCH_THRESHOLD = 88.0;

    private const array ADDITIONAL_INSTRUCTOR_EMAILS = [
        'jaderiel.abuela@laverdad.edu.ph',
    ];

    public function run(): void
    {
        $service = $this->makeSheetsService();

        /** @var array<string, ParsedClass> $parsed */
        $parsed = [];

        foreach (self::TAB_TO_PROGRAM_NAME as $tabName => $programName) {
            $values = $this->fetchTabValues($service, $tabName);

            if ($values === null) {
                Log::warning("ClassSeeder: could not read tab '{$tabName}', skipping.");

                continue;
            }

            $this->parseTab($values, $tabName, $programName, $parsed);
        }

        $instructorMap = $this->buildInstructorNameMap();

        /** @var array<string, string[]> $unmatchedInstructors name => [subjects] */
        $unmatchedInstructors = [];
        $created = 0;
        $updated = 0;

        $programs = Program::query()->get()->keyBy('program_name');
        $devIds = User::query()->whereIn('email', DevInstructorClassSeeder::DEV_INSTRUCTOR_EMAILS)->pluck('id')->all();

        foreach ($parsed as $entry) {
            $program = $programs->get($entry->programName);

            if ($program === null) {
                Log::warning("ClassSeeder: no program row found for '{$entry->programName}', skipping subject '{$entry->subjectName}'.");

                continue;
            }

            $instructorId = null;

            if ($entry->instructorName !== null) {
                $normalized = $this->normalizeName($entry->instructorName);

                if (isset($instructorMap[$normalized])) {
                    $instructorId = $instructorMap[$normalized];
                } else {
                    $fuzzy = $this->findClosestInstructorMatch($normalized, $instructorMap);

                    if ($fuzzy !== null) {
                        [$matchedName, $matchedId, $score] = $fuzzy;
                        $instructorId = $matchedId;

                        Log::warning("ClassSeeder: fuzzy-matched instructor '{$entry->instructorName}' to '{$matchedName}' ({$score}% similarity) for subject '{$entry->subjectName}'. Verify this is correct.");
                    } else {
                        $unmatchedInstructors[$entry->instructorName][] = $entry->subjectName;
                    }
                }
            }

            $attributes = [
                'subject_name' => $entry->subjectName,
                'program_id' => $program->id,
                'year_level' => $entry->yearLevel,
                'semester' => $entry->semester,
                'school_year' => $entry->schoolYear,
                'section' => $this->buildSectionLabel($entry->programAbbreviation, $entry->yearLevel),
            ];

            $values = [
                'instructor_id' => $instructorId,
                'schedule' => array_map(fn (MeetingSlot $s) => $s->toArray(), $entry->slots),
            ];

            $class = ClassModel::query()
                ->where($attributes)
                ->where(function ($q) use ($devIds) {
                    $q->whereNull('instructor_id');

                    if ($devIds !== []) {
                        $q->orWhereNotIn('instructor_id', $devIds);
                    }
                })
                ->first();

            if ($class !== null) {
                if ($class->instructor_id !== $instructorId) {
                    app(TeachingAssignmentService::class)->change($class->id, [
                        'action' => $instructorId ? ($class->instructor_id ? 'change_instructor' : 'assign') : 'remove',
                        'instructor_id' => $instructorId,
                        'expected_revision' => $class->assignment_revision,
                        'reason' => 'ClassSeeder timetable import',
                    ]);
                }
                $class->refresh()->update(['schedule' => $values['schedule']]);
            } else {
                $class = ClassModel::create([...$attributes, ...$values]);
            }

            $class->wasRecentlyCreated ? $created++ : $updated++;
        }

        Log::info('ClassSeeder: run summary', [
            'created' => $created,
            'updated' => $updated,
            'unmatched_instructors' => array_keys($unmatchedInstructors),
        ]);

        $this->call(DevInstructorClassSeeder::class);

        if (! empty($unmatchedInstructors)) {
            $lines = [];
            foreach ($unmatchedInstructors as $name => $subjects) {
                $suggestion = $this->describeClosestSuggestion($name, $instructorMap);
                $suffix = $suggestion !== null ? " — did you mean \"{$suggestion['name']}\" ({$suggestion['score']}% similar)?" : '';

                $lines[] = "  - \"{$name}\" (subjects: ".implode(', ', array_unique($subjects)).')'.$suffix;
            }

            throw new \RuntimeException(
                'ClassSeeder: the following instructor names in the schedule could not be matched to any user in the `users` table (roles: instructor, program_head). '.
                    "Fix the roster sheet or the schedule sheet's spelling, then re-run:\n".
                    implode("\n", $lines)
            );
        }
    }

    private function makeSheetsService(): GoogleSheets
    {
        $client = new GoogleClient;
        $client->setHttpClient(ExternalApiClient::make());
        $client->setApplicationName('ClassSeeder');
        $client->setScopes([GoogleSheets::SPREADSHEETS_READONLY]);
        $client->setAuthConfig($this->resolveCredentials());

        return new GoogleSheets($client);
    }

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

    private function fetchTabValues(GoogleSheets $service, string $tabName): ?array
    {
        try {
            $range = "'{$tabName}'!A1:H200";
            $response = $service->spreadsheets_values->get(self::SPREADSHEET_ID, $range);

            return $response->getValues() ?? [];
        } catch (\Throwable $e) {
            Log::warning("ClassSeeder: failed to fetch tab '{$tabName}': {$e->getMessage()}");

            return null;
        }
    }

    private function parseTab(array $values, string $tabName, string $programName, array &$parsed): void
    {
        $rowCount = count($values);

        $blockStarts = [];
        for ($r = 0; $r < $rowCount; $r++) {
            $cellB = trim((string) ($values[$r][1] ?? ''));

            if (preg_match('/-\s*(1st|2nd|3rd|4th)\s*YEAR/i', $cellB, $m)) {
                $blockStarts[] = ['row' => $r, 'yearLevel' => strtolower($m[1])];
            }
        }

        foreach ($blockStarts as $i => $block) {
            $startRow = $block['row'];
            $endRow = $blockStarts[$i + 1]['row'] ?? $rowCount;

            $semLine = trim((string) ($values[$startRow + 1][1] ?? ''));

            if (! preg_match('/(1st|2nd|3rd|4th)\s*Semester,\s*A\.Y\.\s*(\d{4}-\d{4})/i', $semLine, $sm)) {
                Log::warning("ClassSeeder ({$programName}): could not parse semester/school_year near row ".($startRow + 2).', skipping block.');

                continue;
            }

            $semester = strtolower($sm[1]);
            $schoolYear = $sm[2];

            $dataStart = $startRow + 3;

            $this->parseBlock($values, $dataStart, $endRow, $tabName, $programName, $block['yearLevel'], $semester, $schoolYear, $parsed);
        }
    }

    private function parseBlock(
        array $values,
        int $dataStart,
        int $dataEnd,
        string $tabName,
        string $programName,
        string $yearLevel,
        string $semester,
        string $schoolYear,
        array &$parsed
    ): void {
        foreach (self::DAY_COLUMNS as $col => $dayCode) {
            $r = $dataStart;

            while ($r < $dataEnd) {
                $cell = trim((string) ($values[$r][$col] ?? ''));

                if ($cell === '' || ! preg_match('/^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/', $cell)) {
                    $r++;

                    continue;
                }

                [$start, $end] = array_map('trim', explode('-', $cell, 2));
                $subject = trim((string) ($values[$r + 1][$col] ?? ''));
                $instructor = trim((string) ($values[$r + 2][$col] ?? ''));
                $room = trim((string) ($values[$r + 3][$col] ?? ''));

                $r += 4;

                if ($subject === '' || $this->isSkippable($subject, $instructor)) {
                    continue;
                }

                $entry = new ParsedClass($subject, $programName, $tabName, $yearLevel, $semester, $schoolYear);
                $key = $entry->key();

                if (! isset($parsed[$key])) {
                    $parsed[$key] = $entry;
                }

                if ($instructor !== '') {
                    if ($parsed[$key]->instructorName === null) {
                        $parsed[$key]->instructorName = $instructor;
                    } elseif ($this->normalizeName($parsed[$key]->instructorName) !== $this->normalizeName($instructor)) {
                        Log::warning("ClassSeeder: subject '{$subject}' ({$programName}, {$yearLevel} year) has inconsistent instructor names across meeting days: '{$parsed[$key]->instructorName}' vs '{$instructor}'. Keeping the first one seen.");
                    }
                }

                $parsed[$key]->slots[] = new MeetingSlot(
                    day: $dayCode,
                    start: $this->normalizeTime($start),
                    end: $this->normalizeTime($end),
                    room: $room !== '' ? $room : null,
                );
            }
        }
    }

    private function isSkippable(string $subject, string $instructor): bool
    {
        $haystack = mb_strtolower($subject.' '.$instructor);

        foreach (self::SKIP_KEYWORDS as $keyword) {
            if (str_contains($haystack, $keyword)) {
                return true;
            }
        }

        return false;
    }

    private function buildSectionLabel(string $abbreviation, string $yearLevel): string
    {
        $yearNumber = preg_replace('/\D/', '', $yearLevel);

        return trim($abbreviation.' '.$yearNumber);
    }

    private function normalizeTime(string $time): string
    {
        [$h, $m] = array_pad(explode(':', $time), 2, '00');

        return sprintf('%02d:%02d', (int) $h, (int) $m);
    }

    private function buildInstructorNameMap(): array
    {
        return User::query()
            ->where(function ($query) {
                $query->whereIn('role', ['instructor', 'program_head'])
                    ->orWhereIn('email', self::ADDITIONAL_INSTRUCTOR_EMAILS);
            })
            ->get(['id', 'name'])
            ->mapWithKeys(fn (User $u) => [$this->normalizeName($u->name) => $u->id])
            ->all();
    }

    private function normalizeName(string $name): string
    {
        $name = trim($name);

        foreach (self::HONORIFIC_PREFIXES as $prefix) {
            if (stripos($name, $prefix.' ') === 0) {
                $name = trim(substr($name, strlen($prefix)));
                break;
            }
        }

        $name = preg_replace('/,\s*[A-Za-z.]+$/', '', $name);

        return mb_strtolower(preg_replace('/\s+/', ' ', $name));
    }

    private function findClosestInstructorMatch(string $normalizedName, array $instructorMap): ?array
    {
        $bestName = null;
        $bestId = null;
        $bestScore = 0.0;

        foreach ($instructorMap as $candidateName => $candidateId) {
            similar_text($normalizedName, $candidateName, $percent);

            if ($percent > $bestScore) {
                $bestScore = $percent;
                $bestName = $candidateName;
                $bestId = $candidateId;
            }
        }

        if ($bestName !== null && $bestScore >= self::FUZZY_MATCH_THRESHOLD) {
            return [$bestName, $bestId, round($bestScore, 1)];
        }

        return null;
    }

    private function describeClosestSuggestion(string $rawName, array $instructorMap): ?array
    {
        if (empty($instructorMap)) {
            return null;
        }

        $normalized = $this->normalizeName($rawName);

        $bestName = null;
        $bestScore = 0.0;

        foreach (array_keys($instructorMap) as $candidateName) {
            similar_text($normalized, $candidateName, $percent);

            if ($percent > $bestScore) {
                $bestScore = $percent;
                $bestName = $candidateName;
            }
        }

        if ($bestName === null) {
            return null;
        }

        return ['name' => $bestName, 'score' => round($bestScore, 1)];
    }
}
