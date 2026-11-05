<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_tracker', function (Blueprint $table) {
            $table->decimal('absence_hours', 10, 2)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('attendance_tracker', function (Blueprint $table) {
            $table->dropColumn('absence_hours');
        });
    }
};
