<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Pdo\Mysql;

class CheckApiSecurity extends Command
{
    protected $signature = 'security:check';

    protected $description = 'Check production API configuration without displaying secrets or querying the database';

    public function handle(): int
    {
        $store = config('cache.default');
        $origins = array_filter([config('app.frontend_url'), config('app.frontend_url_prod')]);
        $checks = [
            'Production environment' => config('app.env') === 'production',
            'Debug mode disabled' => config('app.debug') === false,
            'Shared cache for OAuth state, locks and rate limits' => in_array(
                config("cache.stores.{$store}.driver"), ['database', 'redis', 'memcached', 'dynamodb'], true),
            'HTTPS frontend origins' => $origins !== [] && collect($origins)->every(
                fn ($origin) => is_string($origin) && parse_url($origin, PHP_URL_SCHEME) === 'https'),
            'Bounded token lifetime' => config('sanctum.expiration') === 480,
        ];

        // Resolves DB_URL as well, but does not open PDO or execute any SQL.
        $connection = DB::connection()->getConfig();
        if (str_ends_with(strtolower((string) ($connection['host'] ?? '')), '.tidbcloud.com')) {
            $options = $connection['options'] ?? [];
            $ca = $options[Mysql::ATTR_SSL_CA] ?? null;
            $checks['TiDB trusted CA configured and readable'] = is_string($ca) && is_readable($ca);
            $checks['TiDB server certificate verification enabled'] = ($options[Mysql::ATTR_SSL_VERIFY_SERVER_CERT] ?? null) === true;
        }

        foreach ($checks as $label => $passed) {
            $passed ? $this->info('PASS: '.$label) : $this->error('FAIL: '.$label);
        }
        $this->comment('Also verify live HTTPS, forwarded client IPs, shared-cache connectivity, OAuth cookies, and TiDB TLS after deployment.');

        return in_array(false, $checks, true) ? self::FAILURE : self::SUCCESS;
    }
}
