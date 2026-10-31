<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use RuntimeException;

final class EvidenceImageProcessor
{
    public static function process(string $data, string $mime): string
    {
        if (! extension_loaded('gd')) {
            throw new RuntimeException(
                'The GD extension is required for evidence images.'
            );
        }

        $expectedType = match ($mime) {
            'image/jpeg' => IMAGETYPE_JPEG,
            'image/png' => IMAGETYPE_PNG,
            default => throw new InvalidArgumentException(
                'Choose a JPG or PNG image.'
            ),
        };

        $gd = gd_info();

        // JPEG support is required for the output as well.
        if (empty($gd['JPEG Support'])
            || ($mime === 'image/png' && empty($gd['PNG Support']))) {
            Log::error('Evidence image codec unavailable', [
                'mime' => $mime,
                'php_version' => PHP_VERSION,
                'gd' => $gd,
            ]);

            throw new RuntimeException(
                'The server lacks the required JPEG/PNG image support.'
            );
        }

        if ($data === '' || strlen($data) > 2 * 1024 * 1024) {
            throw new InvalidArgumentException(
                'Choose a non-empty image no larger than 2MB.'
            );
        }

        $info = @getimagesizefromstring($data);

        if (! $info || $info[2] !== $expectedType) {
            throw new InvalidArgumentException(
                'The image contents do not match its type.'
            );
        }

        [$width, $height] = $info;

        // Check dimensions before allocating the decoded image.
        if ($width < 1 || $height < 1
            || $width > 8192 || $height > 8192
            || $width * $height > 8_000_000) {
            throw new InvalidArgumentException(
                'Image dimensions are too large. Choose a smaller image.'
            );
        }

        $warnings = [];

        set_error_handler(
            static function (int $severity, string $message) use (&$warnings): bool {
                $warnings[] = substr($message, 0, 500);

                return true;
            },
            E_WARNING
        );

        try {
            $source = imagecreatefromstring($data);
        } finally {
            restore_error_handler();
        }

        if ($source === false) {
            Log::warning('Evidence image decode failed', [
                'mime' => $mime,
                'bytes' => strlen($data),
                'width' => $width,
                'height' => $height,
                'php_version' => PHP_VERSION,
                'gd_version' => $gd['GD Version'] ?? null,
                'jpeg_support' => $gd['JPEG Support'] ?? false,
                'png_support' => $gd['PNG Support'] ?? false,
                'decoder_warnings' => $warnings,
            ]);

            throw new InvalidArgumentException(
                'The server could not decode this image. Please try another image.'
            );
        }

        $canvas = null;

        try {
            $scale = min(1, 1600 / max($width, $height));
            $targetWidth = max(1, (int) round($width * $scale));
            $targetHeight = max(1, (int) round($height * $scale));

            $canvas = imagecreatetruecolor($targetWidth, $targetHeight);

            if ($canvas === false) {
                throw new RuntimeException(
                    'Unable to create an evidence image.'
                );
            }

            $white = imagecolorallocate($canvas, 255, 255, 255);
            imagefill($canvas, 0, 0, $white);

            $resized = imagecopyresampled(
                $canvas,
                $source,
                0,
                0,
                0,
                0,
                $targetWidth,
                $targetHeight,
                $width,
                $height
            );

            if (! $resized) {
                throw new RuntimeException(
                    'Unable to resize an evidence image.'
                );
            }

            ob_start();

            try {
                if (! imagejpeg($canvas, null, 85)) {
                    throw new RuntimeException(
                        'Unable to encode an evidence image.'
                    );
                }

                $result = ob_get_contents();
            } finally {
                ob_end_clean();
            }

            if (! is_string($result)
                || $result === ''
                || strlen($result) > 2 * 1024 * 1024) {
                throw new InvalidArgumentException(
                    'The processed image exceeds the 2MB upload limit.'
                );
            }

            return $result;
        } finally {
            unset($source, $canvas);
        }
    }
}