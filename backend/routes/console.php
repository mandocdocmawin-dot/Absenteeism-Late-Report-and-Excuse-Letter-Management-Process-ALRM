<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('roster:sync')
    ->hourly()
    ->withoutOverlapping()
    ->onFailure(function () {
        Log::alert('roster:sync command reported failure — check logs for unmatched instructors.');
    });