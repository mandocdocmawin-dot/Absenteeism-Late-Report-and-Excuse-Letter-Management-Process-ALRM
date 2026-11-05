<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('otp_codes')->whereRaw('LENGTH(code) = 6')->delete();
    }

    public function down(): void
    {
        // Invalidated authentication codes must not be restored.
    }
};
