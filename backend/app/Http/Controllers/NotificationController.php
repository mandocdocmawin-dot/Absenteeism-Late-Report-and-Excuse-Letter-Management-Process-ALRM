<?php

namespace App\Http\Controllers;

use App\Models\UserNotification;
use App\Support\BoundedCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Shared notification endpoints for authenticated users. Lists and bulk writes
 * are scoped by user ID; single-record writes require the ownership policy.
 */
class NotificationController extends Controller
{
    /**
     * GET /api/notifications/preview
     * Fixed-size bell preview plus the unread count for the entire inbox.
     */
    public function preview(): JsonResponse
    {
        $query = UserNotification::inApp()->where('user_id', Auth::id());

        $notifications = (clone $query)
            ->latest('date_sent')
            ->orderByDesc('id')
            ->limit(5)
            ->get();
        $unreadCount = $this->logicalUnreadCount();

        return response()->json([
            'success' => true,
            'message' => null,
            'data' => [
                'notifications' => $notifications,
                'unread_count' => $unreadCount,
            ],
        ]);
    }

    /**
     * List the authenticated user's notifications, most recent first.
     *
     * GET /api/notifications
     * Optional filter: ?unread=1
     */
    public function index(Request $request): JsonResponse
    {
        $query = UserNotification::inApp()
            ->where('user_id', Auth::id());

        if ($request->boolean('unread')) {
            $query->where('is_read', false);
        }

        $notifications = $query->latest('date_sent');

        return BoundedCollection::respond($notifications);
    }

    /**
     * Logical unread count for a notification bell badge,
     * so the frontend doesn't have to pull the full list just to show a count.
     *
     * GET /api/notifications/unread-count
     */
    public function unreadCount(): JsonResponse
    {
        $count = $this->logicalUnreadCount();

        return response()->json([
            'success' => true,
            'message' => null,
            'data' => ['unread_count' => $count],
        ]);
    }

    private function logicalUnreadCount(): int
    {
        $count = 0;
        $submissions = [];
        $events = [];
        $notifications = UserNotification::inApp()
            ->where('user_id', Auth::id())
            ->where('is_read', false)
            ->select(['id', 'request_id', 'type', 'message', 'date_sent'])
            ->latest('date_sent')->orderByDesc('id')->cursor();

        foreach ($notifications as $notification) {
            $action = match ($notification->type) {
                'new_request', 'submitted_request', 'activity_submitted_request' => 'submitted',
                'request_updated', 'activity_updated_request' => 'updated',
                'request_followup', 'activity_followed_up_request' => 'followed_up',
                'activity_decided_request_approved', 'activity_decided_request_noted' => 'approved',
                'activity_decided_request_invalid' => 'denied',
                'request_decision' => preg_match('/\b(approved|noted)\b/i', $notification->message)
                    ? 'approved'
                    : (preg_match('/\b(invalid|denied)\b/i', $notification->message) ? 'denied' : null),
                default => null,
            };

            if ($notification->request_id && $action === 'submitted') {
                // The instructor feed shows one submission per request.
                if (isset($submissions[$notification->request_id])) {
                    continue;
                }
                $submissions[$notification->request_id] = true;
            } elseif ($notification->request_id && $action && $notification->date_sent) {
                $key = $notification->request_id.':'.$action;
                $source = str_starts_with($notification->type, 'activity_') ? 'activity' : 'direct';
                $timestamp = $notification->date_sent->getTimestamp();
                foreach ($events[$key] ?? [] as $index => $event) {
                    // Pair direct/audit deliveries within the frontend's five-minute window.
                    // Repeated events from the same source remain separate notifications.
                    if (! isset($event['sources'][$source]) && $event['timestamp'] - $timestamp <= 300) {
                        $events[$key][$index]['sources'][$source] = true;

                        continue 2;
                    }
                }
                $events[$key][] = ['timestamp' => $timestamp, 'sources' => [$source => true]];
            }

            $count++;
        }

        return $count;
    }

    /**
     * Mark a single notification as read.
     *
     * PATCH /api/notifications/{notification}/read
     */
    public function markAsRead(UserNotification $notification): JsonResponse
    {
        $this->authorize('update', $notification);

        if (! $notification->is_read) {
            $notification->is_read = true;
            $notification->save();
        }

        return response()->json([
            'success' => true,
            'message' => 'Notification marked as read.',
            'data' => $notification,
        ]);
    }

    /**
     * Mark ALL of the authenticated user's notifications as read.
     * Bulk-updates directly — no need to authorize() per row since the
     * query itself is hard-scoped to Auth::id(); nothing outside the
     * caller's own notifications is ever touched.
     *
     * PATCH /api/notifications/read-all
     */
    public function markAllAsRead(): JsonResponse
    {
        $updated = UserNotification::inApp()
            ->where('user_id', Auth::id())
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json([
            'success' => true,
            'message' => "{$updated} notification(s) marked as read.",
            'data' => null,
        ]);
    }
}
