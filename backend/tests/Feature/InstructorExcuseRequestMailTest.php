<?php

namespace Tests\Feature;

use App\Mail\InstructorExcuseRequestMail;
use App\Models\ClassModel;
use App\Models\ExcuseRequest;
use App\Models\Program;
use App\Models\User;
use Tests\TestCase;

class InstructorExcuseRequestMailTest extends TestCase
{
    public function test_review_button_uses_the_configured_frontend_in_local_and_production(): void
    {
        foreach (['http://localhost:5173/', 'https://absenteeism-late-report-and-excuse.vercel.app/'] as $frontend) {
            config(['app.frontend_url' => $frontend]);

            $html = $this->mail()->render();

            $this->assertStringContainsString(
                'href="'.rtrim($frontend, '/').'/instructor/class-requests"',
                $html,
            );
            $this->assertStringContainsString('images/mail/lv-logo.png', $html);
            $this->assertStringContainsString('ALRM System Notification', $html);
            $this->assertStringContainsString('LA VERDAD CHRISTIAN COLLEGE, INC.', $html);
            $this->assertStringNotContainsString('cid:', $html);
            $this->assertStringNotContainsString('<x-mail::', $html);
        }
    }

    public function test_absence_and_late_details_render_and_student_content_is_escaped(): void
    {
        $absenceHtml = $this->mail()->render();
        $this->assertStringContainsString('Oct 17, 2026', $absenceHtml);
        $this->assertStringContainsString('Program and Year Level', $absenceHtml);
        $this->assertStringContainsString('BSIS — 3rd', $absenceHtml);
        $this->assertStringNotContainsString('Minutes late', $absenceHtml);
        $this->assertStringContainsString('&lt;script&gt;', $absenceHtml);
        $this->assertStringNotContainsString('<script>', $absenceHtml);

        $lateHtml = $this->mail('late')->render();
        $this->assertStringContainsString('Minutes late', $lateHtml);
        $this->assertStringNotContainsString('Date of absence', $lateHtml);
    }

    private function mail(string $type = 'absence'): InstructorExcuseRequestMail
    {
        return new InstructorExcuseRequestMail(
            new ExcuseRequest([
                'type' => $type,
                'subjects_missed' => 'Applications Development',
                'minutes_late' => 15,
                'start_date_of_absence' => '2026-10-17',
                'end_date_of_absence' => '2026-10-17',
                'reason' => "Testing <script>alert(1)</script>\nSecond line",
            ]),
            new User(['name' => 'Test Student']),
            new User(['name' => 'Test Instructor']),
            (new ClassModel([
                'subject_name' => 'Applications Development',
                'section' => 'BSIS 3',
                'year_level' => '3rd',
            ]))->setRelation('program', new Program(['program_name' => 'BSIS'])),
        );
    }
}
