<?php

namespace Tests\Feature;

use App\Models\UserNotification;
use Illuminate\Support\Facades\Schema;
use Tests\SecurityTestCase;

class NotificationPreviewTest extends SecurityTestCase
{
    public function test_badge_and_preview_count_direct_and_activity_submission_pairs_once(): void
    {
        $user = $this->user('instructor');
        $student = $this->user();
        for ($i = 0; $i < 4; $i++) {
            $request = $this->requestFor($student, $user);
            foreach (['new_request', 'activity_submitted_request'] as $type) {
                UserNotification::create([
                    'user_id' => $user->id, 'request_id' => $request->id,
                    'type' => $type, 'message' => 'Student submitted an absence request.',
                    'channel' => 'in_app', 'date_sent' => now()->subMinutes($i), 'is_read' => false,
                ]);
            }
        }

        $this->assertSame(8, UserNotification::where('user_id', $user->id)->count());
        $this->bearer($user)->getJson('/api/notifications/preview')
            ->assertOk()->assertJsonPath('data.unread_count', 4);
        $this->getJson('/api/notifications/unread-count')
            ->assertOk()->assertJsonPath('data.unread_count', 4);
        $this->patchJson('/api/notifications/read-all')->assertOk();
        $this->getJson('/api/notifications/unread-count')
            ->assertOk()->assertJsonPath('data.unread_count', 0);
    }

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

    public function test_count_pairs_deliveries_without_merging_repeated_or_unrelated_events(): void
    {
        $user = $this->user('instructor');
        $request = $this->requestFor($this->user(), $user);
        $date = now()->startOfSecond();
        $rows = [
            ['request_followup', -20, false],
            ['activity_followed_up_request', -16, false],
            ['request_followup', -10, false],
            ['activity_followed_up_request', -6, false],
            // Same-source events and deliveries beyond five minutes stay separate.
            ['request_followup', -9, false],
            ['request_updated', 0, false],
            ['activity_updated_request', 6, false],
            ['request_decision', 0, false],
            ['activity_decided_request_approved', 5, false],
            ['school_notice', 0, false],
            ['school_notice', 0, false],
            ['activity_decided_request_invalid', 0, true],
        ];
        foreach ($rows as [$type, $minutes, $read]) {
            UserNotification::create([
                'user_id' => $user->id, 'request_id' => $request->id, 'type' => $type,
                'message' => 'Your absence request was approved.', 'channel' => 'in_app',
                'date_sent' => $date->copy()->addMinutes($minutes), 'is_read' => $read,
            ]);
        }

        $this->bearer($user)->getJson('/api/notifications/preview')
            ->assertOk()->assertJsonCount(5, 'data.notifications')->assertJsonPath('data.unread_count', 8);
        $this->getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('data.unread_count', 8);
    }

    public function test_logical_count_keeps_unread_duplicates_until_all_deliveries_are_read(): void
    {
        $user = $this->user('instructor');
        $other = $this->user();
        $request = $this->requestFor($other, $user);
        $rows = [
            [$user->id, 'new_request', 'in_app', true],
            [$user->id, 'activity_submitted_request', 'in_app', false],
            [$user->id, 'activity_submitted_request', 'email', false],
            [$other->id, 'activity_submitted_request', 'in_app', false],
        ];
        foreach ($rows as [$id, $type, $channel, $read]) {
            UserNotification::create([
                'user_id' => $id, 'request_id' => $request->id, 'type' => $type,
                'message' => 'Student submitted an absence request.', 'channel' => $channel,
                'date_sent' => now(), 'is_read' => $read,
            ]);
        }
        // Missing request IDs cannot identify a shared event, even for known types.
        for ($i = 0; $i < 2; $i++) {
            UserNotification::create([
                'user_id' => $user->id, 'type' => 'new_request', 'message' => 'Legacy submission.',
                'channel' => 'in_app', 'date_sent' => now(), 'is_read' => false,
            ]);
        }

        $this->bearer($user)->getJson('/api/notifications/preview')
            ->assertOk()->assertJsonPath('data.unread_count', 3);
        $this->getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('data.unread_count', 3);
        $this->patchJson('/api/notifications/read-all')->assertOk();
        $this->getJson('/api/notifications/preview')->assertOk()->assertJsonPath('data.unread_count', 0);
        $this->assertSame(2, UserNotification::where('is_read', false)->count());
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

    public function test_notifications_are_created_with_feed_indexes(): void
    {
        $indexes = [
            'notifications_user_channel_date_id_idx' => ['user_id', 'channel', 'date_sent', 'id'],
            'notifications_user_channel_read_date_idx' => ['user_id', 'channel', 'is_read', 'date_sent'],
        ];
        foreach ($indexes as $name => $columns) {
            $this->assertTrue(Schema::hasIndex('notifications', $name));
            $this->assertTrue(Schema::hasIndex('notifications', $columns));
        }
    }
}
