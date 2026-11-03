<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teaching_assignments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('class_id')->constrained('classes')->restrictOnDelete();
            $table->foreignUuid('instructor_id')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('version');
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->uuid('active_class_id')->nullable()
                ->virtualAs('CASE WHEN ended_at IS NULL THEN class_id ELSE NULL END');
            $table->unique('active_class_id');
            $table->unique(['class_id', 'version']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teaching_assignments');
    }
};
