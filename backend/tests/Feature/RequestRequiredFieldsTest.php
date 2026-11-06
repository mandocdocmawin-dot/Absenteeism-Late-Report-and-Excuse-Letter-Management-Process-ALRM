<?php

namespace Tests\Feature;

use App\Models\ExcuseRequest;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Tests\SecurityTestCase;

class RequestRequiredFieldsTest extends SecurityTestCase
{
    private function payload(User $student): array
    {
        $fixture = $this->requestFor($student);

        return [
            'class_id' => $fixture->enrollment->class_id,
            'type' => 'absence',
            'subjects_missed' => 'Security',
            'start_date_of_absence' => '2026-10-21',
            'end_date_of_absence' => '2026-10-21',
            'reason' => 'Medical appointment',
            'evidence_file_url' => $this->unusedEvidence($student)->id,
            'evidence_type' => 'application/pdf',
            'proof_types' => ['Medical Certificate'],
            'guardian_name' => 'Parent Name',
            'contact_number' => '09123456789',
        ];
    }

    public function test_submission_rejects_each_missing_or_blank_required_field_without_saving(): void
    {
        $student = $this->user();
        $payload = $this->payload($student);
        $this->bearer($student)->postJson('/api/requests', [])->assertUnprocessable();

        foreach (array_keys($payload) as $field) {
            foreach (['omitted', null, '', '   '] as $blank) {
                Cache::flush();
                $input = $payload;
                if ($blank === 'omitted') {
                    unset($input[$field]);
                } else {
                    $input[$field] = $blank;
                }
                $this->bearer($student)->postJson('/api/requests', $input)
                    ->assertUnprocessable()->assertJsonValidationErrors($field);
                $this->assertSame(1, ExcuseRequest::count());
            }
        }
    }

    public function test_update_rejects_missing_or_cleared_required_fields_and_preserves_existing_values(): void
    {
        $student = $this->user();
        $payload = $this->payload($student);
        $id = $this->bearer($student)->postJson('/api/requests', $payload)->assertCreated()->json('data.id');

        foreach (['type', 'subjects_missed', 'start_date_of_absence', 'end_date_of_absence', 'reason', 'evidence_type', 'proof_types'] as $field) {
            foreach (['omitted', null, '', '   '] as $blank) {
                Cache::flush();
                $input = $payload;
                if ($blank === 'omitted') {
                    unset($input[$field]);
                } else {
                    $input[$field] = $blank;
                }
                $this->bearer($student)->patchJson('/api/requests/'.$id, $input)
                    ->assertUnprocessable()->assertJsonValidationErrors($field);
            }
        }
        $record = ExcuseRequest::findOrFail($id);
        $this->assertSame($payload['end_date_of_absence'], $record->end_date_of_absence->toDateString());
        $this->assertSame($payload['proof_types'], $record->proof_types);
    }

    public function test_empty_proof_selection_is_rejected_on_submit_and_edit(): void
    {
        $student = $this->user();
        $payload = $this->payload($student);
        $this->bearer($student)->postJson('/api/requests', array_replace($payload, ['proof_types' => []]))
            ->assertUnprocessable()->assertJsonValidationErrors('proof_types');
        $id = $this->bearer($student)->postJson('/api/requests', $payload)->assertCreated()->json('data.id');
        $this->bearer($student)->patchJson('/api/requests/'.$id, array_replace($payload, ['proof_types' => []]))
            ->assertUnprocessable()->assertJsonValidationErrors('proof_types');
    }

    public function test_late_requests_require_minutes_but_do_not_require_an_absence_end_date(): void
    {
        $student = $this->user();
        $payload = $this->payload($student);
        $payload['type'] = 'late';
        unset($payload['end_date_of_absence']);
        foreach ([null, '', '   ', 0] as $minutes) {
            $this->bearer($student)->postJson('/api/requests', $payload + ['minutes_late' => $minutes])
                ->assertUnprocessable()->assertJsonValidationErrors('minutes_late');
        }
        $payload['minutes_late'] = 10;
        $id = $this->bearer($student)->postJson('/api/requests', $payload)->assertCreated()->json('data.id');
        unset($payload['minutes_late']);
        $this->bearer($student)->patchJson('/api/requests/'.$id, $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('minutes_late');
        $this->bearer($student)->patchJson('/api/requests/'.$id, $payload + ['minutes_late' => 20])->assertOk();
    }

    public function test_absence_date_order_and_consistent_reason_limits_on_submit_and_edit(): void
    {
        $student = $this->user();
        $payload = $this->payload($student);
        $this->bearer($student)->postJson('/api/requests', array_replace($payload, ['end_date_of_absence' => '2026-10-20']))
            ->assertUnprocessable()->assertJsonValidationErrors('end_date_of_absence');
        $payload['reason'] = str_repeat('a', 600);
        $id = $this->bearer($student)->postJson('/api/requests', $payload)->assertCreated()->json('data.id');
        $this->bearer($student)->patchJson('/api/requests/'.$id, $payload)->assertOk();
        $payload['reason'] .= 'a';
        $this->bearer($student)->postJson('/api/requests', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->bearer($student)->patchJson('/api/requests/'.$id, $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('reason');
    }
}
