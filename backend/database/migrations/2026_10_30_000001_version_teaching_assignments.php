<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('classes', function (Blueprint $table) {
            $table->unsignedInteger('assignment_revision')->default(0);
        });
        Schema::create('teaching_assignments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('class_id')->constrained('classes')->restrictOnDelete();
            $table->foreignUuid('instructor_id')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('version');
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->uuid('active_class_id')->nullable()
                ->virtualAs('CASE WHEN ended_at IS NULL THEN class_id ELSE NULL END');
            $table->unique('active_class_id');
            $table->unique(['class_id', 'version']);
            $table->timestamps();
        });
        Schema::table('requests', function (Blueprint $table) {
            $table->foreignUuid('teaching_assignment_id')->nullable()
                ->constrained('teaching_assignments')->restrictOnDelete();
            $table->json('class_snapshot')->nullable();
            $table->string('snapshot_source')->nullable();
        });
        Schema::table('audit_log', function (Blueprint $table) {
            $table->json('details')->nullable();
        });

        DB::transaction(function () {
            DB::table('classes')->orderBy('id')->each(function ($class) {
                $assignmentId = null;
                $instructor = $class->instructor_id ? DB::table('users')->find($class->instructor_id) : null;
                if ($instructor) {
                    $assignmentId = (string) Str::uuid();
                    DB::table('teaching_assignments')->insert([
                        'id' => $assignmentId, 'class_id' => $class->id,
                        'instructor_id' => $instructor->id, 'version' => 1,
                        // This is a baseline at migration time, not a reconstructed start date.
                        'started_at' => now(), 'created_at' => now(), 'updated_at' => now(),
                    ]);
                    DB::table('classes')->where('id', $class->id)->update(['assignment_revision' => 1]);
                }
                $snapshot = (array) $class;
                unset($snapshot['assignment_revision'], $snapshot['created_at'], $snapshot['updated_at']);
                $snapshot['schedule'] = is_string($class->schedule) ? json_decode($class->schedule, true) : $class->schedule;
                $snapshot['instructor'] = $instructor ? ['id' => $instructor->id, 'name' => $instructor->name] : null;
                $program = DB::table('programs')->find($class->program_id);
                $snapshot['program'] = $program ? ['id' => $program->id, 'program_name' => $program->program_name] : null;
                DB::table('requests')->whereIn('enrollment_id', DB::table('enrollments')->select('id')->where('class_id', $class->id))
                    ->update([
                        'teaching_assignment_id' => $assignmentId,
                        'class_snapshot' => json_encode($snapshot, JSON_THROW_ON_ERROR),
                        'snapshot_source' => 'legacy_backfill',
                    ]);
            });
        });
        // Preserve even legacy requests whose class was unassigned at migration time.
        Schema::table('requests', function (Blueprint $table) {
            $table->dropForeign(['enrollment_id']);
            $table->foreign('enrollment_id')->references('id')->on('enrollments')->restrictOnDelete();
        });
        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropForeign(['class_id']);
            $table->foreign('class_id')->references('id')->on('classes')->restrictOnDelete();
            $table->dropForeign(['student_id']);
            $table->foreign('student_id')->references('id')->on('users')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropForeign(['class_id']);
            $table->foreign('class_id')->references('id')->on('classes')->cascadeOnDelete();
            $table->dropForeign(['student_id']);
            $table->foreign('student_id')->references('id')->on('users')->cascadeOnDelete();
        });
        Schema::table('requests', function (Blueprint $table) {
            $table->dropForeign(['enrollment_id']);
            $table->foreign('enrollment_id')->references('id')->on('enrollments')->cascadeOnDelete();
            $table->dropConstrainedForeignId('teaching_assignment_id');
            $table->dropColumn(['class_snapshot', 'snapshot_source']);
        });
        Schema::table('audit_log', fn (Blueprint $table) => $table->dropColumn('details'));
        Schema::dropIfExists('teaching_assignments');
        Schema::table('classes', fn (Blueprint $table) => $table->dropColumn('assignment_revision'));
    }
};
