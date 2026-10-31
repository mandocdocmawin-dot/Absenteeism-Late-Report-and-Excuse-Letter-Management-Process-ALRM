<?php

namespace Tests\Feature;

use App\Http\Controllers\Student\ClassController;
use App\Http\Controllers\Student\RequestController;
use App\Models\ClassModel;
use App\Models\Enrollment;
use App\Models\Program;
use App\Models\User;
use App\Services\TeachingAssignmentService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Tests\SecurityTestCase;

class DeletedInstructorClassTest extends SecurityTestCase
{
    public function test_instructor_history_prevents_deletion_and_removed_assignment_hides_class_without_deleting_enrollments(): void
    {
        $student = User::create(['name' => 'Student', 'email' => 'student@example.com', 'role' => 'student']);
        $instructor = User::create(['name' => 'Instructor', 'email' => 'instructor@example.com', 'role' => 'instructor']);
        $program = Program::create(['program_name' => 'Test Program']);
        $class = ClassModel::create([
            'subject_name' => 'Test Subject',
            'program_id' => $program->id,
            'instructor_id' => $instructor->id,
            'year_level' => '1st',
            'semester' => '1st',
            'school_year' => '2026-2027',
            'section' => 'A',
            'schedule' => [],
        ]);
        $enrollment = Enrollment::create(['student_id' => $student->id, 'class_id' => $class->id, 'year_level' => '1st']);
        Auth::login($student);

        $this->assertCount(1, app(ClassController::class)->index()->getData(true)['data']);
        try {
            $instructor->delete();
            $this->fail('Teaching history must prevent instructor deletion.');
        } catch (QueryException $exception) {
            $this->assertNotNull($instructor->fresh());
        }
        app(TeachingAssignmentService::class)->change($class->id, [
            'action' => 'remove', 'expected_revision' => 1, 'reason' => 'Remove teaching load',
        ]);
        $this->assertNull($class->fresh()->instructor_id);
        $this->assertSame([], app(ClassController::class)->index()->getData(true)['data']);
        $this->assertNotNull($enrollment->fresh());

        $request = Request::create('/api/requests', 'POST', [
            'class_id' => $class->id,
            'type' => 'absence',
            'subjects_missed' => 'Test Subject',
            'start_date_of_absence' => '2026-10-22',
            'reason' => 'Sick',
            'evidence_file_url' => $this->unusedEvidence($student)->id,
            'guardian_name' => 'Parent Name',
            'contact_number' => '09123456789',
        ]);
        $request->setUserResolver(fn () => $student);
        $response = app(RequestController::class)->store($request);
        $this->assertSame(422, $response->getStatusCode());
        $this->assertStringContainsString('no assigned instructor', $response->getData(true)['message']);
    }
}
