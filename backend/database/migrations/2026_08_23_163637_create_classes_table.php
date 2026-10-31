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
            $table->timestamps();
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