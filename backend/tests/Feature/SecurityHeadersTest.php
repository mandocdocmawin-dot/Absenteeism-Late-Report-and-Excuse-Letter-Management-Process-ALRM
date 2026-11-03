<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\SecurityTestCase;

class SecurityHeadersTest extends SecurityTestCase
{
    private const CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

    public function test_api_redirect_and_error_responses_have_security_headers(): void
    {
        Route::middleware('api')->get('/api/header-error', fn () => abort(500));
        $user = $this->user();
        $api = $this->bearer($user)->getJson('/api/me')->assertOk();
        $this->assertStringContainsString('no-store', $api->headers->get('Cache-Control'));
        $responses = [
            $api,
            $this->get('/api/auth/google/callback')
                ->assertRedirect('http://localhost:5173/login?error=oauth_failed'),
            $this->getJson('/api/not-a-route')->assertNotFound(),
            $this->getJson('/api/header-error')->assertStatus(500),
        ];
        foreach ($responses as $response) {
            $response->assertHeader('X-Content-Type-Options', 'nosniff')
                ->assertHeader('X-Frame-Options', 'DENY')
                ->assertHeader('Referrer-Policy', 'no-referrer')
                ->assertHeader('Content-Security-Policy', self::CSP)
                ->assertHeaderMissing('Strict-Transport-Security');
        }
    }

    public function test_welcome_page_is_not_given_the_restrictive_api_csp(): void
    {
        $this->get('/')->assertOk()
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeaderMissing('Content-Security-Policy');
    }

    public function test_json_outside_api_gets_csp_but_other_html_does_not(): void
    {
        Route::get('/header-json', fn () => response()->json(['ok' => true]));
        Route::get('/header-html', fn () => response('<p>Page</p>'));
        $this->get('/header-json')->assertOk()->assertHeader('Content-Security-Policy', self::CSP);
        $this->get('/header-html')->assertOk()->assertHeaderMissing('Content-Security-Policy');
    }

    public static function hstsConditions(): array
    {
        return [
            ['production', 'https', true], ['production', 'http', false],
            ['testing', 'https', false], ['testing', 'http', false],
        ];
    }

    #[DataProvider('hstsConditions')]
    public function test_hsts_is_only_sent_for_secure_production_requests(string $environment, string $scheme, bool $expected): void
    {
        $this->app->detectEnvironment(fn () => $environment);
        $response = $this->get($scheme.'://localhost/api/me')->assertUnauthorized();
        if ($expected) {
            $response->assertHeader('Strict-Transport-Security', 'max-age=31536000');
        } else {
            $response->assertHeaderMissing('Strict-Transport-Security');
        }
    }
}
