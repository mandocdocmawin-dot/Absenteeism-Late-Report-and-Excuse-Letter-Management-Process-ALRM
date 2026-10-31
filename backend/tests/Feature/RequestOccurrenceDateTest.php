<?php

namespace Tests\Feature;

use App\Models\ExcuseRequest;
use Tests\SecurityTestCase;

class RequestOccurrenceDateTest extends SecurityTestCase
{
    public function test_submission_requires_a_valid_occurrence_date_for_both_request_types(): void
    {
        foreach (['late', 'absence'] as $type) {
            $student = $this->user();
            $fixture = $this->requestFor($student);
            $payload = $this->payload($type) + ['class_id' => $fixture->enrollment->class_id];

            foreach ([[], ['start_date_of_absence' => null], ['start_date_of_absence' => 'not-a-date']] as $date) {
                $this->bearer($student)->postJson('/api/requests', $payload + $date)
                    ->assertUnprocessable()->assertJsonValidationErrors('start_date_of_absence');
            }

            $this->assertSame(1, ExcuseRequest::where('enrollment_id', $fixture->enrollment_id)->count());
        }
    }

    public function test_late_occurrence_date_is_saved_and_returned_to_the_instructor(): void
    {
        $student = $this->user();
        $instructor = $this->user('instructor');
        $fixture = $this->requestFor($student, $instructor);
        $payload = $this->payload('late') + [
            'class_id' => $fixture->enrollment->class_id,
            'start_date_of_absence' => '2026-10-18',
            'evidence_file_url' => $this->unusedEvidence($student)->id,
        ];

        $created = $this->bearer($student)->postJson('/api/requests', $payload)->assertCreated();
        $id = $created->json('data.id');
        $this->assertStringStartsWith('2026-10-18', $created->json('data.start_date_of_absence'));
        $this->assertSame('2026-10-18', ExcuseRequest::findOrFail($id)->start_date_of_absence->toDateString());

        foreach (['/api/instructor/requests', '/api/instructor/requests?page=1&per_page=100'] as $url) {
            $response = $this->bearer($instructor)->getJson($url)->assertOk();
            $record = collect($response->json('data'))->firstWhere('id', $id);
            $this->assertNotNull($record);
            $this->assertStringStartsWith('2026-10-18', $record['start_date_of_absence']);
        }
    }

    public function test_edit_cannot_clear_the_occurrence_date_and_can_correct_a_legacy_late_request(): void
    {
        $student = $this->user();
        $request = $this->requestFor($student);
        $request->update(['type' => 'late', 'start_date_of_absence' => null]);

        foreach ([[], ['start_date_of_absence' => null], ['start_date_of_absence' => 'not-a-date']] as $date) {
            $this->bearer($student)->patchJson('/api/requests/'.$request->id, $this->payload('late') + $date)
                ->assertUnprocessable()->assertJsonValidationErrors('start_date_of_absence');
        }

        $response = $this->bearer($student)->patchJson('/api/requests/'.$request->id, $this->payload('late') + [
            'start_date_of_absence' => '2026-10-19',
        ])->assertOk();
        $this->assertStringStartsWith('2026-10-19', $response->json('data.start_date_of_absence'));
        $this->assertSame('2026-10-19', $request->fresh()->start_date_of_absence->toDateString());

        $this->bearer($student)->patchJson('/api/requests/'.$request->id, $this->payload('late') + [
            'start_date_of_absence' => null,
        ])->assertUnprocessable()->assertJsonValidationErrors('start_date_of_absence');
        $this->assertSame('2026-10-19', $request->fresh()->start_date_of_absence->toDateString());
    }

    private function payload(string $type): array
    {
        return [
            'type' => $type,
            'subjects_missed' => 'Security',
            'minutes_late' => $type === 'late' ? 15 : null,
            'reason' => 'Transport delay',
            'guardian_name' => 'Parent Name',
            'contact_number' => '09123456789',
        ];
    }
}
