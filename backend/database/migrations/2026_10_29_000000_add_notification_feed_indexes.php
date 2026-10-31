<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->index(['user_id', 'channel', 'date_sent', 'id'], 'notifications_user_channel_date_id_idx');
            $table->index(['user_id', 'channel', 'is_read', 'date_sent'], 'notifications_user_channel_read_date_idx');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('notifications_user_channel_date_id_idx');
            $table->dropIndex('notifications_user_channel_read_date_idx');
        });
    }
};
