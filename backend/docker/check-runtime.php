<?php

// Keep this independent of Composer/Laravel so it also protects image builds.
$minimumVersions = [
    '8.3' => '8.3.36',
    '8.4' => '8.4.27',
    '8.5' => '8.5.12',
];
$branch = PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;
$minimum = $minimumVersions[$branch] ?? null;

if ($minimum === null || version_compare(PHP_VERSION, $minimum, '<')) {
    fwrite(STDERR, 'Refusing to start ALRM on PHP '.PHP_VERSION.'. '
        ."CERT-EU 2026-018 requires PHP 8.3.36+, 8.4.27+, or 8.5.12+ within those branches.\n");
    exit(1);
}

fwrite(STDOUT, 'PHP '.PHP_VERSION." passes the CERT-EU 2026-018 version check.\n");
