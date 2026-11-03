<?php

namespace Tests\Feature;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;
use Tests\SecurityTestCase;

class GoogleSubjectMigrationTest extends SecurityTestCase
{
    public function test_database_rejects_duplicate_non_null_google_subjects(): void
    {
        $this->user('student', ['google_id' => 'unique-subject']);
        $this->expectException(QueryException::class);
        $this->user('student', ['google_id' => 'unique-subject']);
    }

    public function test_multiple_unlinked_users_with_null_subject_are_allowed(): void
    {
        $this->user('student', ['google_id' => null]);
        $this->user('student', ['google_id' => null]);
        $this->assertDatabaseCount('users', 2);
    }

    public function test_users_are_created_with_the_google_subject_unique_index(): void
    {
        $this->assertTrue(Schema::hasIndex('users', 'users_google_id_unique', 'unique'));
    }

    public function test_distinct_linked_google_subjects_are_allowed(): void
    {
        $this->user('student', ['google_id' => 'first-subject']);
        $this->user('student', ['google_id' => 'second-subject']);
        $this->assertDatabaseCount('users', 2);
    }
}
