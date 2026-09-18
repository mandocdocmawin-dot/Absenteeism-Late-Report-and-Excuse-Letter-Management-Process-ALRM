<?php

namespace App\Http\Controllers;

use App\Models\UserNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Shared notification endpoints for ANY authenticated role (student,
 * instructor, program_head, administrator). Lives outside the
 * role-specific controller folders (Admin/, Instructor/, Student/,
 * ProgramHead/) on purpose — "see my own notifications" isn't a
 * role-gated capability, it's a capability every authenticated user has
 * for their own data.
 *
 * IMPORTANT: every method here is scoped to Auth::id() at the query
 * level (not just via Policy) — this is deliberate defense-in-depth.
 * Route-model-binding a UserNotification by {notification} and relying
 * on the Policy alone would still work, but scoping the query up front
 * means a user can never even discover another user's notification IDs
 * via enumeration/timing, and a 404 (not found) is returned instead of
 * a 403 (forbidden) for someone else's notification — so we don't leak
 * "this ID exists, you're just not allowed to see it."
 */
class NotificationController extends Controller
{
    /**
     * List the authenticated user's notifications, most recent first.
     *
     * GET /api/notifications
     * Optional filter: ?unread=1
     */
    public function index(Request $request): JsonResponse
    {
        $query = UserNotification::query()
            ->where('user_id', Auth::id());

        if ($request->boolean('unread')) {
            $query->where('is_read', false);
        }

        $notifications = $query->latest('date_sent')->get();

        return response()->json([
            'success' => true,
            'message' => null,
            'data'    => $notifications,
        ]);
    }

    /**
     * Unread count only — cheap endpoint for a notification bell badge,
     * so the frontend doesn't have to pull the full list just to show a count.
     *
     * GET /api/notifications/unread-count
     */
    public function unreadCount(): JsonResponse
    {
        $count = UserNotification::query()
            ->where('user_id', Auth::id())
            ->where('is_read', false)
            ->count();

        return response()->json([
            'success' => true,
            'message' => null,
            'data'    => ['unread_count' => $count],
        ]);
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
            'data'    => $notification,
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
        $updated = UserNotification::query()
            ->where('user_id', Auth::id())
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json([
            'success' => true,
            'message' => "{$updated} notification(s) marked as read.",
            'data'    => null,
        ]);
    }
}