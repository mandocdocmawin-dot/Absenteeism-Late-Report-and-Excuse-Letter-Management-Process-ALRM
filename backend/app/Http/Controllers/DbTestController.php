<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Program;

/**
 * DbTestController
 * -----------------
 * Temporary, standalone controller for verifying that the deployed app
 * can actually reach the TiDB Cloud database — separate from all the
 * real ALRM controllers so nothing in the existing business logic is touched.
 *
 * Safe to delete once Priority 6 testing is done.
 */
class DbTestController extends Controller
{
    /**
     * GET /api/health
     * Pings the DB with a raw query. No auth required — quick sanity check.
     */
    public function health()
    {
        try {
            DB::select('select 1 as ok');

            return response()->json([
                'status' => 'ok',
                'database' => config('database.connections.mysql.database'),
                'host' => config('database.connections.mysql.host'),
                'message' => 'Successfully connected to the database.',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/test/programs
     * Lists ALL columns from the real `programs` table — proves SELECT works
     * against whatever data the seeders/migrations already put there.
     * (Using all columns here since this controller doesn't assume the
     * exact schema — check app/Models/Program.php or the ERD if you want
     * to trim this down to specific columns.)
     */
    public function index()
    {
        return response()->json(Program::all());
    }

    /**
     * POST /api/test/programs
     * Body: send whatever fields exist on your Program model's $fillable
     * (check app/Models/Program.php for the exact list — likely something
     * like "name", "code", "program_head_id", etc. per the ERD).
     * Creates a row — proves INSERT works.
     */
    public function store(Request $request)
    {
        // Relies on Program's own $fillable to decide what's mass-assignable.
        // Add ->validate() rules here once you confirm the real column names.
        $program = Program::create($request->all());

        return response()->json($program, 201);
    }

    /**
     * PATCH /api/test/programs/{program}
     * Body: any subset of Program's $fillable fields.
     * Updates a row — proves UPDATE works.
     */
    public function update(Request $request, Program $program)
    {
        $program->update($request->all());

        return response()->json($program);
    }

    /**
     * DELETE /api/test/programs/{program}
     * Deletes a row — proves DELETE works.
     */
    public function destroy(Program $program)
    {
        $program->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}