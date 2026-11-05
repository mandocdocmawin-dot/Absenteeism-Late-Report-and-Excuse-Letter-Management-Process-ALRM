<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE requests MODIFY COLUMN status ENUM('pending', 'approved', 'noted', 'invalid', 'cancelled') DEFAULT 'pending'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE requests MODIFY COLUMN status ENUM('pending', 'approved', 'noted', 'invalid') DEFAULT 'pending'");
    }
};