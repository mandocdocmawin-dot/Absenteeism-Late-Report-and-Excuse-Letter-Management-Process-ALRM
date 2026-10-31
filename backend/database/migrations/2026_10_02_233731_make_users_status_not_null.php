<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Safety net: no NULL rows in prod today, but make sure.
        DB::table('users')->whereNull('status')->update(['status' => 'pending']);

        DB::statement(
            "ALTER TABLE users MODIFY status ENUM('approved','pending','deactivated') NOT NULL DEFAULT 'pending'"
        );
    }

    public function down(): void
    {
        DB::statement(
            "ALTER TABLE users MODIFY status ENUM('approved','pending','deactivated') NULL DEFAULT NULL"
        );
    }
};