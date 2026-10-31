<?php

namespace Tests;

use App\Models\ClassModel;
use App\Models\Enrollment;
use App\Models\ExcuseRequest;
use App\Models\Program;
use App\Models\RequestAttachment;
use App\Models\User;
use App\Services\RequestSnapshot;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;

abstract class SecurityTestCase extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Never use the developer's or Render's database for security tests.
        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
            'cache.default' => 'array',
            'app.frontend_url' => 'http://localhost:5173',
            'app.frontend_url_prod' => 'https://frontend.example.test',
            'institution.student_domain' => 'student.edu.ph',
            'institution.staff_domain' => 'staff.edu.ph',
        ]);
        DB::purge('sqlite');
        Cache::flush();
        Mail::fake();
        Notification::fake();
        foreach (glob(database_path('migrations/*.php')) as $path) {
            if (in_array(basename($path), [
                '2026_09_27_151031_add_cancelled_to_requests_status_enum.php',
                '2026_10_02_233731_make_users_status_not_null.php',
                '2026_10_12_084015_create_request_attachments_table.php',
            ], true)) {
                if (basename($path) === '2026_10_02_233731_make_users_status_not_null.php') {
                    Schema::table('users', function (Blueprint $table) {
                        $table->enum('status', ['approved', 'pending', 'deactivated'])
                            ->nullable(false)->default('pending')->change();
                    });
                }

                continue; // Equivalent portable schema for MySQL-only ALTER statements.
            }
            (require $path)->up();
        }
        Schema::create('request_attachments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('excuse_request_id')->nullable();
            $table->string('original_name');
            $table->string('mime_type');
            $table->integer('size');
            $table->binary('data');
            $table->timestamps();
        });
    }

    protected function user(string $role = 'student', array $attributes = []): User
    {
        return User::factory()->create(['role' => $role, 'status' => 'approved', ...$attributes]);
    }

    protected function requestFor(User $student, ?User $instructor = null, array $classAttributes = []): ExcuseRequest
    {
        $class = ClassModel::create([
            'subject_name' => 'Security', 'program_id' => Program::factory()->create()->id,
            'instructor_id' => ($instructor ?? $this->user('instructor'))->id,
            'year_level' => '1st', 'semester' => '1st', 'school_year' => '2026-2027',
            'schedule' => [],
            ...$classAttributes,
        ]);
        $enrollment = Enrollment::create([
            'student_id' => $student->id, 'class_id' => $class->id, 'year_level' => '1st',
        ]);

        return ExcuseRequest::withoutEvents(function () use ($enrollment, $class) {
            $request = new ExcuseRequest([
                'enrollment_id' => $enrollment->id, 'type' => 'absence',
                'subjects_missed' => 'Security', 'reason' => 'Illness',
                'start_date_of_absence' => '2026-10-21', 'status' => 'pending',
                'date_submitted' => now(),
            ]);
            $request->forceFill(RequestSnapshot::capture($class->refresh(), $class->activeTeachingAssignment()->firstOrFail()));
            $request->save();

            return $request;
        });
    }

    protected function bearer(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('test')->plainTextToken);
    }

    protected function unusedEvidence(User $user): RequestAttachment
    {
        $pdf = \Tests\Support\PdfFixture::make();

        return RequestAttachment::create([
            'user_id' => $user->id, 'original_name' => 'proof.pdf',
            'mime_type' => 'application/pdf', 'size' => strlen($pdf), 'data' => $pdf,
        ]);
    }
}
