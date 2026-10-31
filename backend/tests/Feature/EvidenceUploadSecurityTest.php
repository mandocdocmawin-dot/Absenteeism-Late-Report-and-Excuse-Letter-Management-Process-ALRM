<?php

namespace Tests\Feature;

use App\Models\ExcuseRequest;
use App\Models\RequestAttachment;
use Illuminate\Http\UploadedFile;
use Symfony\Component\Process\Process;
use Tests\SecurityTestCase;
use Tests\Support\PdfFixture;

class EvidenceUploadSecurityTest extends SecurityTestCase
{
    public function test_both_request_types_require_owned_unused_evidence(): void
    {
        foreach (['absence', 'late'] as $type) {
            $student = $this->user();
            $fixture = $this->requestFor($student);
            $payload = [
                'class_id' => $fixture->enrollment->class_id, 'type' => $type,
                'subjects_missed' => 'Security', 'reason' => 'Illness', 'minutes_late' => 5,
                'start_date_of_absence' => '2026-10-22',
                'guardian_name' => 'Parent Name', 'contact_number' => '09123456789',
            ];
            $before = ExcuseRequest::count();
            foreach ([[], ['evidence_file_url' => null], [
                'evidence_file_url' => $this->unusedEvidence($this->user())->id,
            ]] as $extra) {
                $this->bearer($student)->postJson('/api/requests', $payload + $extra)
                    ->assertUnprocessable()->assertJsonValidationErrors('evidence_file_url');
                $this->assertSame($before, ExcuseRequest::count());
            }
            $attachment = $this->unusedEvidence($student);
            $valid = $payload + ['evidence_file_url' => $attachment->id];
            $response = $this->bearer($student)->postJson('/api/requests', $valid)->assertCreated();
            $this->assertSame($response->json('data.id'), $attachment->fresh()->excuse_request_id);
            $this->bearer($student)->postJson('/api/requests', $valid)->assertUnprocessable();
        }
    }

    public function test_passive_pdf_is_accepted(): void
    {
        $this->upload(PdfFixture::make())->assertCreated();
        $this->assertSame(1, RequestAttachment::count());
    }

    public function test_active_and_obfuscated_pdf_actions_are_rejected(): void
    {
        foreach (['/OpenAction', '/Open#41ction'] as $key) {
            $pdf = PdfFixture::make($key.' 4 0 R', [
                '<< /S /Java#53cript /JS (/* inert audit marker */) >>',
            ]);
            $this->upload($pdf)->assertUnprocessable()->assertJsonValidationErrors('file');
        }
        $this->assertSame(0, RequestAttachment::count());
    }

    public function test_compressed_object_actions_are_rejected(): void
    {
        $pdf = PdfFixture::make('/OpenAction 4 0 R', [
            '<< /S /JavaScript /JS (/* inert audit marker */) >>',
        ]);
        $compressed = $this->rewrite($pdf, ['--object-streams=generate', '--stream-data=compress']);
        $this->assertStringContainsString('/ObjStm', $compressed);
        $this->upload($compressed)->assertUnprocessable()->assertJsonValidationErrors('file');
        $this->assertSame(0, RequestAttachment::count());
    }

    public function test_forms_and_embedded_files_are_rejected(): void
    {
        foreach (['/AcroForm << /Fields [] >>', '/Names << /EmbeddedFiles << /Names [] >> >>'] as $catalog) {
            $this->upload(PdfFixture::make($catalog))->assertUnprocessable();
        }
        $this->assertSame(0, RequestAttachment::count());
    }

    public function test_encrypted_and_malformed_pdfs_are_rejected(): void
    {
        $encrypted = $this->rewrite(PdfFixture::make(), ['--encrypt', '', 'audit-owner', '256', '--']);
        $this->upload($encrypted)->assertUnprocessable();
        $this->upload("%PDF-1.4\nnot a PDF")->assertUnprocessable();
        $this->assertSame(0, RequestAttachment::count());
    }

    public function test_missing_pdf_validator_fails_closed(): void
    {
        config(['evidence.qpdf_binary' => 'alrm-nonexistent-qpdf-binary']);
        $response = $this->upload(PdfFixture::make());
        $this->assertNotSame(201, $response->status());
        $this->assertSame(0, RequestAttachment::count());
    }

    private function upload(string $pdf)
    {
        // Windows keeps tmpfile() handles exclusive. Close this fixture before
        // the external parser reads it, matching a real completed HTTP upload.
        $path = tempnam(sys_get_temp_dir(), 'alrm-upload-');
        try {
            file_put_contents($path, $pdf);

            return $this->bearer($this->user())->post('/api/requests/evidence', [
                'file' => new UploadedFile($path, 'proof.pdf', 'application/pdf', null, true),
            ], ['Accept' => 'application/json']);
        } finally {
            unlink($path);
        }
    }

    private function rewrite(string $pdf, array $options): string
    {
        $input = tempnam(sys_get_temp_dir(), 'alrm-pdf-');
        $output = tempnam(sys_get_temp_dir(), 'alrm-pdf-');
        try {
            file_put_contents($input, $pdf);
            $process = new Process([config('evidence.qpdf_binary'), ...$options, $input, $output]);
            $process->setTimeout(5);
            $process->mustRun();

            return file_get_contents($output);
        } finally {
            unlink($input);
            unlink($output);
        }
    }
}
