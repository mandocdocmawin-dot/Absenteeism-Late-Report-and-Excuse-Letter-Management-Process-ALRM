<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('curricula', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('program_id')->constrained()->restrictOnDelete();
            $table->string('version', 50);
            $table->string('revision', 64);
            $table->json('sources');
            $table->timestamps();
            $table->unique(['program_id', 'version', 'revision']);
        });
        Schema::create('curriculum_subjects', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('curriculum_id')->constrained()->restrictOnDelete();
            $table->string('year_level', 3);
            $table->string('semester', 10);
            $table->string('code', 100);
            $table->string('subject_name');
            $table->decimal('credit_units', 6, 2)->nullable();
            $table->decimal('lecture_units', 6, 2)->nullable();
            $table->decimal('laboratory_units', 6, 2)->nullable();
            $table->string('units_text', 100)->nullable();
            $table->json('source');
            $table->timestamps();
            $table->unique(['curriculum_id', 'year_level', 'semester', 'code'], 'curriculum_subject_identity');
        });
        Schema::create('program_offerings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('curriculum_id')->constrained()->restrictOnDelete();
            $table->string('school_year', 9);
            $table->string('year_level', 3);
            $table->string('semester', 10);
            $table->string('code', 100);
            $table->string('subject_name');
            $table->decimal('credit_units', 6, 2)->nullable();
            $table->string('units_text', 100)->nullable();
            $table->json('source');
            $table->timestamps();
            $table->unique(['curriculum_id', 'school_year', 'year_level', 'semester', 'code'], 'program_offering_identity');
        });
        Schema::table('classes', function (Blueprint $table) {
            $table->foreignUuid('curriculum_subject_id')->nullable()->constrained()->restrictOnDelete();
            $table->decimal('credit_units', 6, 2)->nullable();
            $table->decimal('weekly_hours', 7, 2)->default(3)->change();
        });
    }

    public function down(): void
    {
        Schema::table('classes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('curriculum_subject_id');
            $table->dropColumn('credit_units');
        });
        Schema::dropIfExists('program_offerings');
        Schema::dropIfExists('curriculum_subjects');
        Schema::dropIfExists('curricula');
        // Keep decimal weekly_hours to avoid truncating existing fractional hours.
    }
};
