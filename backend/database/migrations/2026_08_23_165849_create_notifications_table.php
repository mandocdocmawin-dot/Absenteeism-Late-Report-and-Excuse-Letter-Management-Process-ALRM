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
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('request_id')->nullable()->constrained('requests')->nullOnDelete();
            $table->string('type');
            $table->text('message');
            $table->enum('channel', ['email', 'in_app']);
            $table->timestamp('date_sent')->useCurrent();
            $table->boolean('is_read')->default(false);

            $table->index(['user_id', 'channel', 'date_sent', 'id'], 'notifications_user_channel_date_id_idx');
            $table->index(['user_id', 'channel', 'is_read', 'date_sent'], 'notifications_user_channel_read_date_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
