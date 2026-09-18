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
            $table->foreignUuid('enrollment_id')->constrained('enrollments')->cascadeOnDelete();
            $table->enum('type', ['absence', 'late']);
            $table->date('start_date_of_absence');
            $table->date('end_date_of_absence')->nullable();
            $table->text('reason');
            $table->string('evidence_file_url')->nullable();
            $table->string('evidence_type')->nullable();
            $table->enum('status', ['pending', 'approved', 'noted', 'invalid'])->default('pending');
            $table->timestamp('date_submitted')->nullable();
            $table->timestamp('date_reviewed')->nullable();
            $table->foreignUuid('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
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