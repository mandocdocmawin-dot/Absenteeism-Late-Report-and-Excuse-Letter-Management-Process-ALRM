<?php

namespace Tests\Feature;

use App\Http\Controllers\Student\RequestController;
use App\Models\ExcuseRequest;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Mockery;
use Mockery\MockInterface;
use Tests\SecurityTestCase;

class RequestProofTypesTest extends SecurityTestCase
{
    public function test_migration_preserves_existing_requests_and_rolls_back(): void
    {
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
        DB::purge('sqlite');

        Schema::create('requests', function (Blueprint $table) {
            $table->id();
            $table->string('reason');
        });
        DB::table('requests')->insert(['reason' => 'may sakit po e']);

        $migration = require database_path('migrations/2026_10_12_090000_add_proof_types_to_requests_table.php');
        $migration->up();

        $this->assertTrue(Schema::hasColumn('requests', 'proof_types'));
        $this->assertNull(DB::table('requests')->first()->proof_types);
        $this->assertSame('may sakit po e', DB::table('requests')->first()->reason);

        $migration->down();
        $this->assertFalse(Schema::hasColumn('requests', 'proof_types'));
        $this->assertSame(1, DB::table('requests')->count());
    }

    public function test_update_saves_multiple_proof_types_separately_from_mime_and_reason(): void
    {
        $payload = $this->payload() + [
            'proof_types' => ['Medical Certificate', 'Letter from Parent/Guardian'],
            'evidence_type' => 'image/jpeg',
        ];
        $owner = $this->user();
        $model = $this->requestFor($owner);
        $response = $this->bearer($owner)->patchJson('/api/requests/'.$model->id, $payload)->assertOk();
        $data = $response->json('data');

        $this->assertSame($payload['proof_types'], $data['proof_types']);
        $this->assertSame('image/jpeg', $data['evidence_type']);
        $this->assertSame('may sakit po e', $data['reason']);
    }

    public function test_update_rejects_unknown_duplicate_and_non_array_proof_types(): void
    {
        foreach ([['image/jpeg'], ['Others', 'Others'], 'Medical Certificate', ['unknown'], ['invalid_key' => 'Others']] as $proofTypes) {
            /** @var ExcuseRequest&MockInterface $model */
            $model = Mockery::mock(ExcuseRequest::class)->makePartial();
            $model->status = 'pending';
            $model->shouldNotReceive('update');

            try {
                $this->controller()->update(Request::create('/', 'PATCH', $this->payload() + ['proof_types' => $proofTypes]), $model);
                $this->fail('Invalid proof types should be rejected.');
            } catch (ValidationException $exception) {
                $this->assertNotEmpty(array_filter(array_keys($exception->errors()), fn ($key) => str_starts_with($key, 'proof_types')));
            }
        }
    }

    public function test_update_preserves_omitted_proof_types_and_allows_clearing_them(): void
    {
        foreach ([[], ['proof_types' => []], ['proof_types' => null]] as $extra) {
            $payload = $this->payload() + $extra;
            $owner = $this->user();
            $model = $this->requestFor($owner);
            $model->update(['proof_types' => ['Medical Certificate']]);
            $response = $this->bearer($owner)->patchJson('/api/requests/'.$model->id, $payload)->assertOk();
            $this->assertSame(array_key_exists('proof_types', $extra) ? $extra['proof_types'] : ['Medical Certificate'], $response->json('data.proof_types'));
        }
    }

    private function controller(): RequestController
    {
        /** @var RequestController&MockInterface $controller */
        $controller = Mockery::mock(RequestController::class)->makePartial();
        $controller->shouldReceive('authorize')->once()->with('update', Mockery::type(ExcuseRequest::class))->andReturnNull();

        return $controller;
    }

    private function payload(): array
    {
        return [
            'type' => 'late',
            'subjects_missed' => 'Networking',
            'minutes_late' => 23,
            'start_date_of_absence' => '2026-10-21',
            'reason' => 'may sakit po e',
        ];
    }
}
