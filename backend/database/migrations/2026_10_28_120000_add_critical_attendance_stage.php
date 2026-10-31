<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_tracker', function (Blueprint $table) {
            $table->enum('status', ['safe', 'warning', 'critical', 'IR'])->default('safe')->change();
            $table->timestamp('critical_notified_at')->nullable();
        });

        // Historical IR meant consultation. Preserve its delivery timestamp at
        // that stage, leaving the new drop-limit notification available.
        DB::table('attendance_tracker')->whereNotNull('ir_notified_at')->update([
            'critical_notified_at' => DB::raw('ir_notified_at'),
            'ir_notified_at' => null,
        ]);
        DB::table('attendance_tracker')->where('status', 'IR')->update(['status' => 'critical']);
    }

    public function down(): void
    {
        DB::table('attendance_tracker')->where('status', 'critical')->update(['status' => 'IR']);
        DB::table('attendance_tracker')->whereNull('ir_notified_at')->update([
            'ir_notified_at' => DB::raw('critical_notified_at'),
        ]);
        Schema::table('attendance_tracker', function (Blueprint $table) {
            $table->enum('status', ['safe', 'warning', 'IR'])->default('safe')->change();
            $table->dropColumn('critical_notified_at');
        });
    }
};
