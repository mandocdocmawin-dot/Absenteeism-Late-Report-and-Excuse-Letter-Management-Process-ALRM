<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('enrollment_id')->constrained('enrollments')->restrictOnDelete();
            $table->enum('type', ['absence', 'late']);
            $table->text('subjects_missed');
            $table->unsignedInteger('minutes_late')->nullable();
            $table->date('start_date_of_absence')->nullable();
            $table->date('end_date_of_absence')->nullable();
            $table->text('reason');
            $table->string('evidence_file_url')->nullable();
            $table->string('evidence_type')->nullable();
            $table->json('proof_types')->nullable();
            $table->enum('status', ['pending', 'approved', 'noted', 'invalid', 'cancelled'])->default('pending');
            $table->timestamp('date_submitted')->nullable();
            $table->timestamp('date_reviewed')->nullable();
            $table->foreignUuid('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('teaching_assignment_id')->nullable()
                ->constrained('teaching_assignments')->restrictOnDelete();
            $table->json('class_snapshot')->nullable();
            $table->string('snapshot_source')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('requests');
    }
};
