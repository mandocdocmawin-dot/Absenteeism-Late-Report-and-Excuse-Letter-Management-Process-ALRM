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
        Schema::create('classes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('subject_name');
            $table->string('section')->nullable();
            $table->enum('semester', ['1st', '2nd']);
            $table->string('school_year'); // format: '2025-2026'
            $table->foreignUuid('instructor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('schedule');
            $table->foreignUuid('program_id')->constrained('programs')->cascadeOnDelete();
            $table->string('year_level');
            $table->decimal('weekly_hours', 7, 2)->default(3);
            $table->unsignedTinyInteger('meetings_per_week')->default(1);
            $table->foreignUuid('curriculum_subject_id')->nullable()->constrained()->restrictOnDelete();
            $table->decimal('credit_units', 6, 2)->nullable();
            $table->unsignedInteger('assignment_revision')->default(0);
            $table->timestamps();

            $table->index(['program_id', 'year_level', 'semester'], 'classes_program_year_semester_idx');
            $table->index(['instructor_id', 'program_id'], 'classes_instructor_program_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('classes');
    }
};
