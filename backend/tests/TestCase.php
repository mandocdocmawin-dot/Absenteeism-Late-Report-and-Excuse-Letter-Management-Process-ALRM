<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Mail\Mailer;
use Illuminate\Mail\Transport\ArrayTransport;
use Illuminate\Support\Facades\Mail;
use LogicException;

abstract class TestCase extends BaseTestCase
{
    protected function arrayMailTransport(): ArrayTransport
    {
        $mailer = Mail::mailer();
        if (! $mailer instanceof Mailer) {
            throw new LogicException('This assertion requires the concrete Laravel mailer.');
        }

        $transport = $mailer->getSymfonyTransport();
        if (! $transport instanceof ArrayTransport) {
            throw new LogicException('This assertion requires the array mail transport.');
        }

        return $transport;
    }
}
