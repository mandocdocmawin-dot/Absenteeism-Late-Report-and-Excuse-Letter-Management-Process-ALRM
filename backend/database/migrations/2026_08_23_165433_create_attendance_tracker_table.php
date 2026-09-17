<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_tracker', function (Blueprint $table) {
            $table->id();
            $table->foreignId('enrollment_id')->constrained('enrollments')->cascadeOnDelete();
            $table->unsignedInteger('total_lates')->default(0);
            $table->unsignedInteger('total_absences')->default(0);
            $table->unsignedInteger('converted_absences')->default(0);
            $table->enum('status', ['safe', 'warning', 'IR'])->default('safe');
            $table->timestamp('warning_notified_at')->nullable();
            $table->timestamp('ir_notified_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_tracker');
    }
};