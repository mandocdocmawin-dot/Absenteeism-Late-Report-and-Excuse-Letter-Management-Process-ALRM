<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Cache\ArrayStore;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Http\Request;
use Illuminate\Notifications\ChannelManager;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;
use Laravel\Socialite\Two\InvalidStateException;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\SecurityTestCase;

class OAuthFailureBoundaryTest extends SecurityTestCase
{
    public static function failureStages(): array
    {
        return array_map(fn ($stage) => [$stage], [
            'invalid-state', 'provider', 'save', 'pending-cache', 'state-cache', 'mail',
        ]);
    }

    #[DataProvider('failureStages')]
    public function test_callback_failures_return_the_existing_safe_redirect_and_log_only_class(string $stage): void
    {
        $failure = $stage === 'invalid-state'
            ? new InvalidStateException('code=sensitive token=sensitive')
            : new RuntimeException('code=sensitive token=sensitive');
        $nonce = Str::random(64);
        Cache::put('oauth_state:'.hash('sha256', $nonce), true, 600);
        $state = Crypt::encryptString(json_encode([
            'origin' => 'http://localhost:5173', 'nonce' => $nonce,
            'exp' => now()->addMinutes(10)->timestamp,
        ]));

        if ($stage !== 'state-cache') {
            $provider = Mockery::mock(GoogleProvider::class);
            $provider->shouldReceive('setHttpClient')->once()->andReturnSelf();
            $provider->shouldReceive('stateless')->once()->andReturnSelf();
            $provider->shouldReceive('redirectUrl')->once()
                ->with('http://localhost:5173/api/auth/google/callback')->andReturnSelf();
            $userCall = $provider->shouldReceive('user')->once();
            if (in_array($stage, ['provider', 'invalid-state'], true)) {
                $userCall->andThrow($failure);
            } else {
                $userCall->andReturn((new SocialiteUser)->setRaw(['email_verified' => true])->map([
                    'id' => 'google-failure-test', 'email' => 'person@student.edu.ph', 'name' => 'Person',
                ]));
            }
            Socialite::shouldReceive('driver')->once()->with('google')->andReturn($provider);
        } else {
            Socialite::shouldReceive('driver')->never();
        }

        User::query(); // Boot normal model listeners before cloning the dispatcher.
        $originalDispatcher = User::getEventDispatcher();
        if ($stage === 'save') {
            User::setEventDispatcher(clone $originalDispatcher);
            User::saving(function () use ($failure) { throw $failure; });
        } elseif ($stage === 'pending-cache') {
            $store = new class($failure) extends ArrayStore
            {
                public function __construct(private \Throwable $failure)
                {
                    parent::__construct();
                }

                public function put($key, $value, $seconds)
                {
                    if (str_starts_with($key, 'auth_pending:')) {
                        throw $this->failure;
                    }

                    return parent::put($key, $value, $seconds);
                }
            };
            $store->put('oauth_state:'.hash('sha256', $nonce), true, 600);
            Cache::store()->setStore($store);
        } elseif ($stage === 'state-cache') {
            Cache::partialMock()->shouldReceive('lock')->once()->andThrow($failure);
        } elseif ($stage === 'mail') {
            Notification::swap(new ChannelManager($this->app));
            Mail::shouldReceive('mailer')->once()->andThrow($failure);
        }

        Log::shouldReceive('warning')->once()->with('Google OAuth callback failed', [
            'exception' => get_class($failure),
        ]);

        try {
            $response = $this->withUnencryptedCookies(['alrm_oauth' => $nonce])
                ->get('/api/auth/google/callback?'.http_build_query(['state' => $state, 'code' => 'sensitive']));
            $response->assertRedirect('http://localhost:5173/login?error=oauth_failed');
            $response->assertCookieExpired('alrm_oauth');
            $this->assertStringNotContainsString('sensitive', $response->getContent());
            $this->assertDatabaseCount('personal_access_tokens', 0);
        } finally {
            User::setEventDispatcher($originalDispatcher);
        }
    }

    public function test_auth_exception_reporting_and_rendering_omit_raw_messages(): void
    {
        $request = Request::create('/api/auth/exchange?code=sensitive', 'POST');
        $this->app->instance('request', $request);
        $exception = new RuntimeException('token=sensitive');
        Log::shouldReceive('warning')->once()->with('Authentication request failed', [
            'exception' => RuntimeException::class,
        ]);
        Log::shouldReceive('error')->once()->with('Unhandled API exception', [
            'exception' => RuntimeException::class,
        ]);
        $handler = $this->app->make(ExceptionHandler::class);
        $handler->report($exception);
        $response = $handler->render($request, $exception);
        $this->assertSame(500, $response->getStatusCode());
        $this->assertSame([
            'success' => false, 'message' => 'Something went wrong. Please try again later.', 'data' => null,
        ], $response->getData(true));
    }

    public function test_non_auth_exception_log_context_is_preserved(): void
    {
        $request = Request::create('/api/example');
        Log::shouldReceive('error')->once()->with('Unhandled API exception', Mockery::on(
            fn ($context) => $context['message'] === 'diagnostic'
                && $context['path'] === 'api/example'
                && isset($context['file'], $context['line'])
        ));
        $response = $this->app->make(ExceptionHandler::class)
            ->render($request, new RuntimeException('diagnostic'));
        $this->assertSame(500, $response->getStatusCode());
    }
}
