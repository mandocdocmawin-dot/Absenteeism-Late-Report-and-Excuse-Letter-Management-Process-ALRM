<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_log', function (Blueprint $table) {
            $table->uuid('user_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        if (DB::table('audit_log')->whereNull('user_id')->exists()) {
            throw new RuntimeException('Cannot require an audit actor while system audit events exist. Preserve these records before rolling back.');
        }

        Schema::table('audit_log', function (Blueprint $table) {
            $table->uuid('user_id')->nullable(false)->change();
        });
    }
};
