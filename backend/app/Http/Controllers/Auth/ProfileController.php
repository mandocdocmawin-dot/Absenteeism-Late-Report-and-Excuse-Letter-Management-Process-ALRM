<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\ClassModel;
use App\Models\Enrollment;
use App\Models\Program;
use App\Models\User;
use App\Services\AcademicPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    public function updateNotificationPreferences(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email_notifications_enabled' => ['required', 'boolean'],
        ]);

        $user = $request->user();
        $user->forceFill([
            'email_notifications_enabled' => (bool) $validated['email_notifications_enabled'],
        ])->save();

        return response()->json([
            'success' => true,
            'data' => [
                'email_notifications_enabled' => $user->email_notifications_enabled,
            ],
        ]);
    }

    public function programs(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => Program::query()
                ->where('program_name', '!=', 'General Education')
                ->orderBy('program_name')
                ->get(['id', 'program_name']),
        ]);
    }

    /**
     * POST /api/complete-profile
     *
     * Rules depend on the SERVER-side role ($user->role). The old
     * required_if:role,student looked at the request input, which is
     * always empty because `role` is prohibited, so student fields were
     * never actually required.
     *
     * A student whose profile is already complete cannot re-submit it:
     * enrollments hang off program/year_level, so changing them is an
     * admin-side action, not a self-service one.
     */
    public function completeProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $isStudent = $user->role === 'student';

        if ($isStudent && $user->program_id !== null && $user->school_id_number !== null && $user->year_level !== null) {
            return response()->json([
                'success' => false,
                'message' => 'Your profile is already complete. Please contact an administrator to change your program or year level.',
                'data' => null,
            ], 409);
        }

        // Pre-registration may supply any subset. Keep assigned values immutable
        // while allowing the student to submit only the fields still missing.
        if ($isStudent) {
            $request->mergeIfMissing($user->only(['program_id', 'school_id_number', 'year_level']));
        }

        $validated = $request->validate([
            'program_id' => [
                'required', 'string', 'uuid', 'exists:programs,id',
                Rule::when($isStudent && $user->program_id !== null, [Rule::in([$user->program_id])]),
            ],
            'school_id_number' => [
                Rule::requiredIf($isStudent),
                'nullable',
                'string',
                'max:50',
                Rule::unique('users', 'school_id_number')->ignore($user->id),
                Rule::when($isStudent && $user->school_id_number !== null, ['required', Rule::in([$user->school_id_number])]),
            ],
            'year_level' => [
                Rule::requiredIf($isStudent),
                'nullable',
                Rule::in(['1st', '2nd', '3rd', '4th']),
                Rule::when($isStudent && $user->year_level !== null, ['required', Rule::in([$user->year_level])]),
            ],
            'role' => ['prohibited'],
            'status' => ['prohibited'],
        ]);

        if ($isStudent) {
            DB::transaction(function () use ($user, $validated) {
                $user->forceFill([
                    'program_id' => $validated['program_id'],
                    'school_id_number' => $validated['school_id_number'],
                    'year_level' => $validated['year_level'],
                ])->save();

                $this->autoEnrollStudent(
                    $user,
                    $validated['program_id'],
                    $validated['year_level'],
                );
            });
        } else {
            DB::transaction(function () use ($user, $validated) {
                if (array_key_exists('school_id_number', $validated)) {
                    $user->forceFill(['school_id_number' => $validated['school_id_number']])->save();
                }
                $user->programs()->syncWithoutDetaching([$validated['program_id']]);
            });
        }

        return response()->json([
            'success' => true,
            'message' => 'Profile completed.',
            'data' => new UserResource($user->fresh('program', 'programs')),
        ]);
    }

    protected function autoEnrollStudent(User $user, string $programId, string $yearLevel): void
    {
        $matchingClasses = ClassModel::query()
            ->where('program_id', $programId)
            ->where('year_level', $yearLevel)
            ->where('semester', AcademicPeriod::semester())
            ->where('school_year', AcademicPeriod::schoolYear())
            ->get();

        foreach ($matchingClasses as $class) {
            Enrollment::firstOrCreate(
                [
                    'student_id' => $user->id,
                    'class_id' => $class->id,
                ],
                [
                    'year_level' => $yearLevel,
                ]
            );
        }
    }
}
