<?php

namespace Tests\Feature;

use App\Models\ExcuseRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Tests\SecurityTestCase;

class InstructorRequestExportTest extends SecurityTestCase
{
    private const URL = '/api/instructor/requests/export';

    public function test_export_requires_an_authenticated_active_instructor(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        foreach (['student', 'program_head', 'administrator'] as $role) {
            $this->bearer($this->user($role))->getJson(self::URL)->assertForbidden();
        }
        $this->bearer($this->user('instructor', ['status' => 'deactivated']))
            ->getJson(self::URL)->assertForbidden();
    }

    public function test_export_is_an_xlsx_download_scoped_to_the_instructors_classes(): void
    {
        $instructor = $this->user('instructor');
        $student = $this->user('student', ['name' => '=1+1']);
        $own = $this->requestFor($student, $instructor, ['subject_name' => '+SUM(1,2)', 'section' => '@SUM(1,2)', 'year_level' => '-1+1']);
        $own->update(['date_submitted' => '2026-10-22 10:00:00']);
        $this->requestFor($this->user('student', ['name' => 'Other instructors student']));

        $response = $this->bearer($instructor)->getJson(self::URL)->assertOk();
        $this->assertStringContainsString('.xlsx', $response->headers->get('Content-Disposition'));
        $this->assertStringContainsString('spreadsheetml', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $response->assertHeader('X-Content-Type-Options', 'nosniff');

        $book = $this->loadWorkbook($response);
        $sheet = $book->getActiveSheet();
        $this->assertSame(2, $sheet->getHighestRow());
        $this->assertSame(9, count($sheet->toArray()[0]));
        foreach (['A2' => '+SUM(1,2)', 'B2' => '-1+1', 'C2' => '@SUM(1,2)', 'D2' => '=1+1'] as $cell => $value) {
            $this->assertSame($value, $sheet->getCell($cell)->getValue());
            $this->assertSame(DataType::TYPE_STRING, $sheet->getCell($cell)->getDataType());
        }
        $this->assertSame('2026-10-21', $sheet->getCell('E2')->getValue());
        $this->assertSame('2026-10-22', $sheet->getCell('G2')->getValue());
        $this->assertSame('2026-10-24', $sheet->getCell('H2')->getValue());
        $this->assertStringNotContainsString('Illness', json_encode($sheet->toArray()));
        $book->disconnectWorksheets();
    }

    public function test_filters_combine_and_search_wildcards_are_literal(): void
    {
        $instructor = $this->user('instructor');
        $first = $this->requestFor($this->user('student', ['name' => 'Student 100%_! Match']), $instructor);
        $first->update(['type' => 'late', 'status' => 'approved', 'start_date_of_absence' => null]);
        $this->requestFor($this->user('student', ['name' => 'Student other Match']), $instructor);

        $response = $this->bearer($instructor)->getJson(self::URL.'?'.http_build_query([
            'class_id' => $first->enrollment->class_id, 'type' => 'late', 'status' => 'approved', 'search' => '100%_!',
        ]))->assertOk();
        $book = $this->loadWorkbook($response);
        $rows = $book->getActiveSheet()->toArray();
        $this->assertCount(2, $rows);
        $this->assertSame('Student 100%_! Match', $rows[1][3]);
        $this->assertEmpty($rows[1][4]);
        $book->disconnectWorksheets();

        $response = $this->bearer($instructor)->getJson(self::URL.'?status=invalid')->assertOk();
        $book = $this->loadWorkbook($response);
        $this->assertSame(1, $book->getActiveSheet()->getHighestRow());
        $book->disconnectWorksheets();
    }

    public function test_invalid_filters_and_other_instructors_classes_are_rejected(): void
    {
        $instructor = $this->user('instructor');
        $foreign = $this->requestFor($this->user());
        foreach ([
            'class_id' => $foreign->enrollment->class_id,
            'type' => 'unknown', 'status' => 'unknown', 'search' => str_repeat('a', 51),
        ] as $key => $value) {
            // Separate users avoid conflating validation with the export throttle.
            $this->bearer($instructor)->getJson(self::URL.'?'.http_build_query([$key => $value]))
                ->assertUnprocessable()->assertJsonValidationErrors($key);
            $instructor = $this->user('instructor');
        }
    }

    public function test_type_and_status_filters_exclude_other_requests_in_the_same_class(): void
    {
        $instructor = $this->user('instructor');
        $fixture = $this->requestFor($this->user(), $instructor);
        $fixture->update(['type' => 'late', 'status' => 'approved']);
        ExcuseRequest::withoutEvents(function () use ($fixture) {
            foreach ([['late', 'pending'], ['absence', 'approved']] as [$type, $status]) {
                $copy = $fixture->replicate();
                $copy->type = $type;
                $copy->status = $status;
                $copy->save();
            }
        });

        $response = $this->bearer($instructor)->getJson(self::URL.'?type=late&status=approved')->assertOk();
        $book = $this->loadWorkbook($response);
        $rows = $book->getActiveSheet()->toArray();
        $this->assertCount(2, $rows);
        $this->assertSame('late', $rows[1][5]);
        $this->assertSame('approved', $rows[1][8]);
        $book->disconnectWorksheets();
    }

    public function test_literal_search_excludes_nonmatching_students_without_a_class_filter(): void
    {
        $instructor = $this->user('instructor');
        $this->requestFor($this->user('student', ['name' => 'Student 100%_! Match']), $instructor);
        $this->requestFor($this->user('student', ['name' => 'Student 100abc Match']), $instructor);
        $response = $this->bearer($instructor)->getJson(self::URL.'?'.http_build_query(['search' => '100%_!']))->assertOk();
        $book = $this->loadWorkbook($response);
        $rows = $book->getActiveSheet()->toArray();
        $this->assertCount(2, $rows);
        $this->assertSame('Student 100%_! Match', $rows[1][3]);
        $book->disconnectWorksheets();
    }

    public function test_export_limit_rejects_overflow_without_a_partial_download(): void
    {
        $instructor = $this->user('instructor');
        $fixture = $this->requestFor($this->user(), $instructor);
        $rows = [];
        for ($i = 0; $i < 5000; $i++) {
            $rows[] = [
                'id' => (string) Str::uuid(), 'enrollment_id' => $fixture->enrollment_id,
                'teaching_assignment_id' => $fixture->teaching_assignment_id,
                'type' => 'absence', 'subjects_missed' => 'Security', 'reason' => 'Illness',
                'status' => 'pending', 'date_submitted' => now(), 'created_at' => now(), 'updated_at' => now(),
            ];
        }
        foreach (array_chunk($rows, 100) as $chunk) {
            DB::table('requests')->insert($chunk);
        }
        $this->assertSame(5001, ExcuseRequest::count());
        $this->bearer($instructor)->getJson(self::URL)->assertUnprocessable()
            ->assertJsonPath('message', 'Export exceeds the 5000-row limit. Narrow the class, type, status or search filters.');
    }

    public function test_export_is_rate_limited_per_user(): void
    {
        $instructor = $this->user('instructor');
        for ($i = 0; $i < 3; $i++) {
            $this->bearer($instructor)->getJson(self::URL)->assertOk();
        }
        $this->bearer($instructor)->getJson(self::URL)->assertStatus(429);
        $this->bearer($this->user('instructor'))->getJson(self::URL)->assertOk();
    }

    private function loadWorkbook(TestResponse $response): Spreadsheet
    {
        $download = $response->baseResponse;
        if (! $download instanceof BinaryFileResponse) {
            throw new \UnexpectedValueException('Expected an Excel binary file download response.');
        }

        return IOFactory::load($download->getFile()->getPathname());
    }
}
