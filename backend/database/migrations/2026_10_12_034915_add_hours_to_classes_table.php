<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('classes', function (Blueprint $table) {
            $table->unsignedTinyInteger('weekly_hours')->default(3)->after('year_level');
            $table->unsignedTinyInteger('meetings_per_week')->default(1)->after('weekly_hours');
        });
    }

    public function down(): void
    {
        Schema::table('classes', function (Blueprint $table) {
            $table->dropColumn(['weekly_hours', 'meetings_per_week']);
        });
    }
};