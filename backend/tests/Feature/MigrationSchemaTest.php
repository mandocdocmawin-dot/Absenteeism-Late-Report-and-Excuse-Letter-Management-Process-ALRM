<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\SecurityTestCase;

class MigrationSchemaTest extends SecurityTestCase
{
    public function test_all_migrations_roll_back_and_reapply_in_dependency_order(): void
    {
        $before = $this->schema();
        $paths = glob(database_path('migrations/*.php'));

        foreach (array_reverse($paths) as $path) {
            (require $path)->down();
        }
        $this->assertSame([], Schema::getTableListing());

        foreach ($paths as $path) {
            (require $path)->up();
            foreach (Schema::getTableListing() as $table) {
                foreach (Schema::getForeignKeys($table) as $key) {
                    $this->assertTrue(Schema::hasTable($key['foreign_table']), basename($path));
                }
            }
        }

        $this->assertSame($before, $this->schema());
        $this->assertSame([], DB::select('PRAGMA foreign_key_check'));
    }

    public function test_consolidated_tables_keep_the_final_columns_indexes_and_delete_rules(): void
    {
        $this->assertCount(27, Schema::getTableListing());
        foreach ([
            'users' => ['google_id', 'school_id_number', 'status', 'email_notifications_enabled'],
            'classes' => ['weekly_hours', 'meetings_per_week', 'credit_units', 'curriculum_subject_id', 'assignment_revision'],
            'requests' => ['proof_types', 'teaching_assignment_id', 'class_snapshot', 'snapshot_source'],
            'attendance_tracker' => ['absence_hours', 'critical_notified_at', 'ir_notified_at'],
            'audit_log' => ['details'],
            'request_attachments' => ['data'],
        ] as $table => $columns) {
            $this->assertTrue(Schema::hasColumns($table, $columns), $table);
        }
        foreach ([
            'users' => ['users_admin_status_role_name_idx', 'users_admin_program_status_name_idx', 'users_admin_year_status_name_idx'],
            'classes' => ['classes_program_year_semester_idx', 'classes_instructor_program_idx'],
            'audit_log' => ['audit_log_action_table_timestamp_idx', 'audit_log_table_record_idx', 'audit_log_user_timestamp_idx'],
        ] as $table => $indexes) {
            foreach ($indexes as $index) {
                $this->assertTrue(Schema::hasIndex($table, $index), $index);
            }
        }
        foreach ([
            'enrollments' => ['student_id' => 'restrict', 'class_id' => 'restrict'],
            'requests' => ['enrollment_id' => 'restrict', 'teaching_assignment_id' => 'restrict'],
            'classes' => ['curriculum_subject_id' => 'restrict'],
            'teaching_assignments' => ['class_id' => 'restrict', 'instructor_id' => 'restrict'],
            'users' => ['program_id' => 'set null'],
        ] as $table => $rules) {
            $keys = collect(Schema::getForeignKeys($table))->keyBy(fn ($key) => $key['columns'][0]);
            foreach ($rules as $column => $action) {
                $this->assertSame($action, $keys[$column]['on_delete'], $table.'.'.$column);
            }
        }
    }

    private function schema(): array
    {
        $schema = [];
        foreach (Schema::getTableListing() as $table) {
            $schema[$table] = [
                'columns' => Schema::getColumns($table),
                'indexes' => Schema::getIndexes($table),
                'foreign_keys' => Schema::getForeignKeys($table),
            ];
        }

        return $schema;
    }
}
