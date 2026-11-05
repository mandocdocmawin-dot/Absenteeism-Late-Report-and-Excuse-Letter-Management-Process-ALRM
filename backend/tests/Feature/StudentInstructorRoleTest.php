<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\SecurityTestCase;

class StudentInstructorRoleTest extends SecurityTestCase
{
    public function test_ordinary_students_cannot_be_saved_as_instructors(): void
    {
        $student = $this->user('student', ['email' => 'ordinary@student.edu.ph']);
        try {
            $student->update(['role' => 'instructor']);
            $this->fail('Unexpected instructor promotion.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('role', $e->errors());
        }
        $this->assertSame('student', $student->fresh()->role);
    }

    public function test_only_the_four_designated_student_accounts_can_be_instructors(): void
    {
        config(['institution.student_domain' => 'student.laverdad.edu.ph']);
        foreach (User::STUDENT_INSTRUCTOR_EMAILS as $email) {
            $this->assertSame('instructor', $this->user('instructor', ['email' => $email])->role);
        }
        $this->expectException(ValidationException::class);
        $this->user('instructor', ['email' => 'other@student.laverdad.edu.ph']);
    }

    public function test_repair_is_dry_by_default_and_preserves_allowlisted_and_staff_accounts(): void
    {
        config(['institution.student_domain' => 'student.laverdad.edu.ph']);
        $student = $this->user('student', ['email' => 'ordinary@student.laverdad.edu.ph']);
        $dev = $this->user('instructor', ['email' => User::STUDENT_INSTRUCTOR_EMAILS[0]]);
        $staff = $this->user('instructor', ['email' => 'teacher@laverdad.edu.ph']);
        // Simulate an existing bad record written outside Eloquent.
        DB::table('users')->where('id', $student->id)->update(['role' => 'instructor']);
        $student->createToken('old-instructor-session');
        $this->artisan('alrm:repair-student-instructors')->assertSuccessful();
        $this->assertSame('instructor', $student->fresh()->role);
        $this->artisan('alrm:repair-student-instructors', ['--apply' => true])->assertSuccessful();
        $this->assertSame('student', $student->fresh()->role);
        $this->assertSame(0, $student->tokens()->count());
        $this->assertSame('instructor', $dev->fresh()->role);
        $this->assertSame('instructor', $staff->fresh()->role);
        $this->artisan('alrm:repair-student-instructors', ['--apply' => true])->assertSuccessful();
    }
}
