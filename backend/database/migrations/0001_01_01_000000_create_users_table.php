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
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('google_id')->nullable();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->enum('role', ['administrator', 'program_head', 'instructor', 'student'])->nullable();
            // program_id is a plain UUID column here (no FK yet) because
            // the `programs` table doesn't exist until a later migration,
            // and `programs.program_head_id` references back to `users` —
            // the FK constraint itself is added in
            // add_program_id_foreign_to_users_table once both tables exist.
            $table->uuid('program_id')->nullable();
            $table->string('school_student_id')->nullable()->unique();
            $table->enum('status', ['approved', 'pending', 'deactivated'])->nullable();
            $table->timestamp('deactivated_at')->nullable();
            $table->enum('year_level', ['1st', '2nd', '3rd', '4th'])->nullable();
            $table->string('guardian_name')->nullable();
            $table->string('contact_number')->nullable();
            $table->string('password')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};