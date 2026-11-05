<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

final class SingleUseCode
{
    public static function consume(string $key): mixed
    {
        $lock = Cache::lock('consume:'.hash('sha256', $key), 10);
        if (! $lock->get()) {
            return null;
        }

        try {
            return Cache::pull($key);
        } finally {
            $lock->release();
        }
    }
}
