<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_log', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('action');
            $table->string('table_affected');
            $table->uuid('record_id');
            $table->timestamp('timestamp')->useCurrent();
            $table->json('details')->nullable();

            $table->index(['action', 'table_affected', 'timestamp'], 'audit_log_action_table_timestamp_idx');
            $table->index(['table_affected', 'record_id'], 'audit_log_table_record_idx');
            $table->index(['user_id', 'timestamp'], 'audit_log_user_timestamp_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_log');
    }
};
