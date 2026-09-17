<?php

namespace App\Providers;

use App\Models\AttendanceTracker;
use App\Models\ClassModel;
use App\Models\ExcuseRequest;
use App\Models\FollowupFlag;
use App\Models\Program;
use App\Models\User;
use App\Policies\AttendanceTrackerPolicy;
use App\Policies\ClassModelPolicy;
use App\Policies\ExcuseRequestPolicy;
use App\Policies\FollowupFlagPolicy;
use App\Policies\ProgramPolicy;
use App\Policies\UserPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Gate::policy(ExcuseRequest::class, ExcuseRequestPolicy::class);
        Gate::policy(Program::class, ProgramPolicy::class);
        Gate::policy(ClassModel::class, ClassModelPolicy::class);
        Gate::policy(FollowupFlag::class, FollowupFlagPolicy::class);
        Gate::policy(AttendanceTracker::class, AttendanceTrackerPolicy::class);
        Gate::policy(User::class, UserPolicy::class);
    }
}