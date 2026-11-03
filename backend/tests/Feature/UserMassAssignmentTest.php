<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Eloquent\MassAssignmentException;
use Illuminate\Database\Eloquent\Model;
use Tests\SecurityTestCase;

class UserMassAssignmentTest extends SecurityTestCase
{
    public function test_sensitive_fields_cannot_be_filled_and_fail_loudly_in_testing(): void
    {
        $user = $this->user();
        $this->assertTrue(Model::preventsSilentlyDiscardingAttributes());

        foreach (['role' => 'administrator', 'status' => 'approved',
            'google_id' => 'attacker', 'password' => 'attacker-password',
            'email' => 'attacker@example.test', 'program_id' => 'attacker',
            'deactivated_at' => now(), 'remember_token' => 'attacker',
            'email_verified_at' => now()] as $field => $value) {
            $original = $user->getAttributes();
            try {
                $user->fill([$field => $value]);
                $this->fail("Sensitive field {$field} was accepted.");
            } catch (MassAssignmentException) {
                $this->assertSame($original, $user->getAttributes());
            }
        }
    }

    public function test_sensitive_fields_are_ignored_when_production_discard_mode_is_used(): void
    {
        $user = $this->user();
        $original = $user->getAttributes();
        Model::preventSilentlyDiscardingAttributes(false);
        try {
            $user->fill(['role' => 'administrator', 'status' => 'deactivated',
                'google_id' => 'attacker', 'email' => 'attacker@example.test',
                'password' => 'attacker-password']);
            $this->assertSame($original, $user->getAttributes());
        } finally {
            Model::preventSilentlyDiscardingAttributes(true);
        }
    }

    public function test_only_the_expected_profile_fields_can_be_mass_assigned(): void
    {
        $user = $this->user();
        $profile = ['name' => 'Updated Name', 'school_id_number' => 'ID-123',
            'year_level' => '2nd', 'guardian_name' => 'Guardian',
            'contact_number' => '09123456789'];
        $user->fill($profile)->save();
        $this->assertSame($profile, $user->fresh()->only(array_keys($profile)));
        $this->assertEqualsCanonicalizing(array_keys($profile), $user->getFillable());
    }
}
