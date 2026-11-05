<?php

namespace Tests\Feature;

use App\Providers\AppServiceProvider;
use Illuminate\Foundation\Application;
use LogicException;
use Tests\TestCase;

class ProductionMailSafetyTest extends TestCase
{
    public function test_production_web_requests_reject_log_and_array_mailers(): void
    {
        $application = $this->createMock(Application::class);
        $application->method('environment')->with('production')->willReturn(true);
        $application->method('runningInConsole')->willReturn(false);

        foreach (['log', 'array'] as $mailer) {
            config(['mail.default' => $mailer]);
            try {
                (new AppServiceProvider($application))->boot();
                $this->fail('Production web requests must reject non-delivery mailers.');
            } catch (LogicException $exception) {
                $this->assertSame('Production requires a delivery mailer; configure MAIL_MAILER.', $exception->getMessage());
            }
        }
    }

    public function test_production_console_commands_can_boot_with_a_log_mailer(): void
    {
        $application = $this->createMock(Application::class);
        $application->method('environment')->with('production')->willReturn(true);
        $application->method('runningInConsole')->willReturn(true);
        config(['mail.default' => 'log']);

        (new AppServiceProvider($application))->boot();
        $this->assertNotContains('log', config('mail.mailers.failover.mailers'));
    }
}
