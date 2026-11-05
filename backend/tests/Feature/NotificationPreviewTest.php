<?php

namespace Tests\Feature;

use App\Models\UserNotification;
use Illuminate\Support\Facades\Schema;
use Tests\SecurityTestCase;

class NotificationPreviewTest extends SecurityTestCase
{
    public function test_preview_is_bounded_scoped_and_counts_unread_outside_the_preview(): void
    {
        $user = $this->user('instructor');
        $other = $this->user();
        $expected = [];
        for ($i = 0; $i < 8; $i++) {
            $notification = UserNotification::create([
                'user_id' => $user->id,
                'type' => 'request_submitted',
                'message' => "Notification {$i}",
                'channel' => 'in_app',
                'date_sent' => now()->subMinutes(8 - $i),
                'is_read' => $i === 7,
            ]);
            $expected[] = $notification->id;
        }
        foreach ([[$user->id, 'email'], [$other->id, 'in_app']] as [$id, $channel]) {
            UserNotification::create([
                'user_id' => $id, 'type' => 'request_submitted', 'message' => 'Excluded',
                'channel' => $channel, 'date_sent' => now(), 'is_read' => false,
            ]);
        }

        $response = $this->bearer($user)->getJson('/api/notifications/preview');
        $response->assertOk()->assertJsonPath('success', true)
            ->assertJsonCount(5, 'data.notifications')->assertJsonPath('data.unread_count', 7);
        $this->assertSame(array_reverse(array_slice($expected, -5)), array_column($response->json('data.notifications'), 'id'));
        $this->assertSame(7, UserNotification::inApp()->where('user_id', $user->id)->where('is_read', false)->count());

        // Existing inbox and badge clients keep their original response shapes.
        $this->getJson('/api/notifications')->assertOk()->assertJsonCount(8, 'data');
        $this->getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('data.unread_count', 7);
        $this->patchJson('/api/notifications/read-all')->assertOk();
        $this->getJson('/api/notifications/preview')->assertOk()->assertJsonPath('data.unread_count', 0);
    }

    public function test_empty_preview_is_available_to_each_active_role(): void
    {
        foreach (['student', 'instructor', 'program_head', 'administrator'] as $role) {
            $this->bearer($this->user($role))->getJson('/api/notifications/preview')
                ->assertOk()->assertExactJson([
                    'success' => true, 'message' => null,
                    'data' => ['notifications' => [], 'unread_count' => 0],
                ]);
        }
    }

    public function test_preview_requires_authentication_and_an_active_account(): void
    {
        $this->getJson('/api/notifications/preview')->assertUnauthorized();
        $this->bearer($this->user('instructor', ['status' => 'deactivated']))
            ->getJson('/api/notifications/preview')->assertForbidden();
    }

    public function test_equal_timestamps_have_a_stable_preview_order(): void
    {
        $user = $this->user();
        $date = now();
        $ids = [];
        for ($i = 1; $i <= 7; $i++) {
            $id = sprintf('00000000-0000-4000-8000-%012d', $i);
            UserNotification::forceCreate([
                'id' => $id, 'user_id' => $user->id, 'type' => 'request_submitted',
                'message' => 'Same timestamp', 'channel' => 'in_app', 'date_sent' => $date,
                'is_read' => false,
            ]);
            $ids[] = $id;
        }
        $response = $this->bearer($user)->getJson('/api/notifications/preview')->assertOk();
        $this->assertSame(array_reverse(array_slice($ids, -5)), array_column($response->json('data.notifications'), 'id'));
    }

    public function test_feed_indexes_can_be_rolled_back_and_reapplied(): void
    {
        $indexes = [
            'notifications_user_channel_date_id_idx' => ['user_id', 'channel', 'date_sent', 'id'],
            'notifications_user_channel_read_date_idx' => ['user_id', 'channel', 'is_read', 'date_sent'],
        ];
        foreach ($indexes as $name => $columns) {
            $this->assertTrue(Schema::hasIndex('notifications', $name));
            $this->assertTrue(Schema::hasIndex('notifications', $columns));
        }
        $migration = require database_path('migrations/2026_10_29_000000_add_notification_feed_indexes.php');
        $migration->down();
        foreach (array_keys($indexes) as $name) {
            $this->assertFalse(Schema::hasIndex('notifications', $name));
        }
        $migration->up();
        foreach (array_keys($indexes) as $name) {
            $this->assertTrue(Schema::hasIndex('notifications', $name));
        }
    }
}
