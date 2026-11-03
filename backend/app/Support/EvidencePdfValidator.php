<?php

namespace App\Support;

use InvalidArgumentException;
use JsonException;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;

final class EvidencePdfValidator
{
    // Reject actions, forms, embedded files and interactive media. Inspect parsed
    // names, including indirect/compressed objects, rather than matching PDF bytes.
    private const FORBIDDEN_NAMES = [
        '/A', '/AA', '/OpenAction', '/JS', '/JavaScript', '/Launch',
        '/EmbeddedFiles', '/EmbeddedFile', '/EF', '/Filespec', '/AF',
        '/AcroForm', '/XFA', '/RichMedia', '/RichMediaContent',
        '/RichMediaSettings', '/Collection', '/SubmitForm', '/ImportData',
        '/GoToR', '/GoToE', '/Rendition', '/Movie', '/Sound', '/3D',
        '/Encrypt',
    ];

    public static function validate(string $path): void
    {
        $process = new Process([
            config('evidence.qpdf_binary', 'qpdf'), '--json=2',
            '--json-key=qpdf', '--json-key=encrypt', '--json-key=pages',
            '--json-stream-data=none', $path,
        ]);
        $process->setTimeout(5);
        $bytes = 0;

        try {
            $process->run(function (string $type, string $chunk) use (&$bytes): void {
                $bytes += strlen($chunk);
                if ($bytes > 8 * 1024 * 1024) {
                    throw new InvalidArgumentException('This PDF is too complex. Upload a simpler PDF or an image.');
                }
            });
        } catch (ProcessTimedOutException) {
            throw new InvalidArgumentException('This PDF took too long to validate. Upload a simpler PDF or an image.');
        } finally {
            if ($process->isRunning()) {
                $process->stop(0);
            }
        }

        // Warnings/repaired files and missing tools fail closed; never fall back
        // to a header check. Do not expose parser diagnostics or server paths.
        if (! $process->isSuccessful()) {
            throw new InvalidArgumentException('This PDF could not be validated. Upload a valid, unencrypted PDF or an image.');
        }

        try {
            $document = json_decode($process->getOutput(), true, 128, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new InvalidArgumentException('This PDF could not be validated. Upload a simpler PDF or an image.');
        }

        if (($document['qpdf'][0]['jsonversion'] ?? null) !== 2
            || ! is_array($document['qpdf'][1] ?? null)
            || ($document['encrypt']['encrypted'] ?? true) !== false
            || ! is_array($document['pages'] ?? null)
            || $document['pages'] === []) {
            throw new InvalidArgumentException('Choose an unencrypted PDF containing at least one page.');
        }

        self::inspect($document['qpdf'][1]);
    }

    private static function inspect(mixed $value): void
    {
        if (is_string($value) && in_array($value, self::FORBIDDEN_NAMES, true)) {
            throw new InvalidArgumentException('PDF actions, forms, embedded files and interactive media are not allowed. Upload a flattened PDF or an image.');
        }

        if (! is_array($value)) {
            return;
        }

        foreach ($value as $key => $child) {
            if (is_string($key)) {
                self::inspect($key);
            }
            self::inspect($child);
        }
    }
}
