<?php

namespace App\Providers;

use App\Mail\Transport\BrevoDiagnosticTransport;
use App\Models\AttendanceTracker;
use App\Models\ClassModel;
use App\Models\Curriculum;
use App\Models\ExcuseRequest;
use App\Models\FollowupFlag;
use App\Models\Program;
use App\Models\User;
use App\Models\UserNotification;
use App\Policies\AttendanceTrackerPolicy;
use App\Policies\ClassModelPolicy;
use App\Policies\CurriculumPolicy;
use App\Policies\ExcuseRequestPolicy;
use App\Policies\FollowupFlagPolicy;
use App\Policies\ProgramPolicy;
use App\Policies\UserNotificationPolicy;
use App\Policies\UserPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\HttpClient\HttpClient;
use Symfony\Component\Mailer\Bridge\Brevo\Transport\BrevoTransportFactory;
use Symfony\Component\Mailer\Transport\Dsn;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        if ($this->app->environment('production')
            && ! $this->app->runningInConsole()
            && in_array(config('mail.default'), ['log', 'array'], true)) {
            throw new \LogicException('Production requires a delivery mailer; configure MAIL_MAILER.');
        }

        Sanctum::authenticateAccessTokensUsing(function (PersonalAccessToken $token, bool $valid): bool {
            $lastActivity = $token->last_used_at ?? $token->created_at;

            return $valid && $lastActivity !== null
                && $lastActivity->gt(now()->subMinutes(15));
        });

        RateLimiter::for('api', fn (Request $request) => [
            Limit::perMinute(300)->by('api:ip:'.$request->ip()),
            Limit::perMinute(120)->by('api:user:'.($request->user()?->id ?? $request->ip())),
        ]);
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(20)->by('login:'.$request->ip()));
        RateLimiter::for('otp', function (Request $request) {
            $pending = $request->input('pending');

            return [
                Limit::perMinute(10)->by('otp:ip:'.$request->ip()),
                Limit::perMinute(10)->by('otp:pending:'.hash('sha256', is_string($pending) ? $pending : 'invalid')),
            ];
        });
        RateLimiter::for('submissions', fn (Request $request) => [
            Limit::perMinute(5)->by('submit:minute:'.$request->user()->id),
            Limit::perDay(50)->by('submit:day:'.$request->user()->id),
        ]);
        RateLimiter::for('exports', fn (Request $request) => Limit::perMinute(3)->by('export:'.$request->user()->id));

        Gate::policy(ExcuseRequest::class, ExcuseRequestPolicy::class);
        Gate::policy(Program::class, ProgramPolicy::class);
        Gate::policy(ClassModel::class, ClassModelPolicy::class);
        Gate::policy(Curriculum::class, CurriculumPolicy::class);
        Gate::policy(FollowupFlag::class, FollowupFlagPolicy::class);
        Gate::policy(AttendanceTracker::class, AttendanceTrackerPolicy::class);
        Gate::policy(User::class, UserPolicy::class);
        Gate::policy(UserNotification::class, UserNotificationPolicy::class);

        Mail::extend('brevo', function () {
            $transport = (new BrevoTransportFactory(client: HttpClient::create([
                'timeout' => config('mail.brevo_timeout', 20),
                'max_duration' => config('mail.brevo_max_duration', 25),
                'max_redirects' => 0,
            ])))->create(
                new Dsn(
                    'brevo+api',
                    'default',
                    config('services.brevo.key')
                )
            );

            return new BrevoDiagnosticTransport(
                $transport,
                app('log'),
                (string) config('services.brevo.key'),
            );
        });

        // Request-mail redirects are handled by the delivery services.
        // Do not apply a global alwaysTo override: OTP must reach the login account.
    }
}
