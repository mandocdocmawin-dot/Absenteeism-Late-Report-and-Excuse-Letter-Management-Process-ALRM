<?php

namespace App\Enums;

/**
 * Single source of truth for users.status. Values match the DB enum:
 * enum('approved','pending','deactivated') NULL.
 */
enum UserStatus: string
{
    case Approved = 'approved';
    case Pending = 'pending';
    case Deactivated = 'deactivated';

    /**
     * Allowlist: only these statuses may sign in / keep a session.
     * ('pending' can sign in but RoleMiddleware still blocks role routes.)
     */
    public function canLogin(): bool
    {
        return match ($this) {
            self::Approved, self::Pending => true,
            self::Deactivated => false,
        };
    }

    /**
     * Fail closed: NULL or any unknown value returns false.
     */
    public static function allowsLogin(?string $status): bool
    {
        if ($status === null) {
            return false;
        }

        return self::tryFrom($status)?->canLogin() ?? false;
    }
}