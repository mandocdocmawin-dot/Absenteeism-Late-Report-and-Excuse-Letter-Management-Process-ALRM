<?php

namespace App\Support;

use GuzzleHttp\Client;

final class ExternalApiClient
{
    public static function make(): Client
    {
        return new Client([
            'connect_timeout' => 5,
            'timeout' => 15,
            'allow_redirects' => false,
            'verify' => true,
        ]);
    }
}
