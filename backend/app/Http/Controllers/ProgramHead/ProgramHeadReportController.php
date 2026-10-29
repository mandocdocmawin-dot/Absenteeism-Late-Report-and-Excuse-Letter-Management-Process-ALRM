<?php

namespace App\Http\Controllers\ProgramHead;

use App\Http\Controllers\Controller;
use App\Models\ExcuseRequest;
use App\Models\FollowupFlag;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProgramHeadReportController extends Controller
{
    private const MAX_ROWS = 5000;

    public function export(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        $programIds = $user->headedProgramIds();
        abort_unless($programIds !== [], 403, 'No program is assigned to this account.');

        $filters = $request->validate([
            'report_type' => ['nullable', Rule::in(['activity', 'risk'])],
            'program_id' => ['nullable', 'uuid', Rule::in($programIds)],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from'],
        ]);
        $risk = ($filters['report_type'] ?? 'activity') === 'risk';
        $to = Carbon::parse($filters['date_to'] ?? now()->toDateString())->startOfDay();
        $from = isset($filters['date_from'])
            ? Carbon::parse($filters['date_from'])->startOfDay()
            : $to->copy()->subDays(365);
        if ($from->greaterThan($to) || $from->diffInDays($to) > 730) {
            throw ValidationException::withMessages(['date_to' => 'Choose an ordered date range of 730 days or fewer.']);
        }
        $programIds = isset($filters['program_id']) ? [$filters['program_id']] : $programIds;

        /** @var Builder<FollowupFlag>|Builder<ExcuseRequest> $query */
        $query = $risk ? FollowupFlag::query() : ExcuseRequest::query();
        // Never broaden risk reports just because a flag was escalated to this account.
        $query->whereHas($risk ? 'request.enrollment.class' : 'enrollment.class',
            fn ($query) => $query->whereIn('program_id', $programIds));
        $dateColumn = $risk ? 'flagged_date' : 'COALESCE(date_submitted, created_at)';
        $query->whereRaw($dateColumn.' >= ? AND '.$dateColumn.' < ?', [
            $from->toDateTimeString(), $to->copy()->addDay()->toDateTimeString(),
        ]);

        $count = (clone $query)->limit(self::MAX_ROWS + 1)->toBase()->pluck($risk ? 'followup_flags.id' : 'requests.id')->count();
        abort_if($count > self::MAX_ROWS, 422, 'Export exceeds the 5000-row limit. Narrow the program or date range.');

        $prefix = $risk ? 'request.' : '';
        $query->select($risk
            ? ['id', 'request_id', 'flagged_date', 'status']
            : ['id', 'enrollment_id', 'type', 'date_submitted', 'created_at']);
        $relations = [
            $prefix.'enrollment:id,student_id,class_id',
            $prefix.'enrollment.student:id,name',
            $prefix.'enrollment.class:id,subject_name,schedule,weekly_hours,meetings_per_week',
        ];
        if ($risk) {
            $relations[] = 'request:id,enrollment_id';
            $relations[] = 'request.enrollment.attendanceTracker';
        }
        $rows = $query->with($relations)->orderByRaw($dateColumn.' DESC')->orderBy('id')->limit(self::MAX_ROWS + 1)->get();
        abort_if($rows->count() > self::MAX_ROWS, 422, 'Export exceeds the 5000-row limit. Narrow the program or date range.');

        return response()->streamDownload(function () use ($rows, $risk) {
            $output = fopen('php://output', 'wb');
            fwrite($output, "\xEF\xBB\xBF");
            $this->writeRow($output, $risk
                ? ['Student', 'Class', 'Flagged date', 'Threshold', 'Percentage']
                : ['Student', 'Class', 'Submitted', 'Type']);
            foreach ($rows as $row) {
                if ($risk) {
                    /** @var FollowupFlag $flag */
                    $flag = $row;
                    $record = $flag->request;
                    $date = $flag->flagged_date;
                    $details = array_values($flag->attendanceRisk());
                } else {
                    /** @var ExcuseRequest $record */
                    $record = $row;
                    $date = $record->date_submitted ?? $record->created_at;
                    $details = [$record->type];
                }
                $values = [
                    $record?->enrollment?->student?->name ?? '',
                    $record?->enrollment?->class?->subject_name ?? '',
                    $date?->toDateString() ?? '',
                ];
                $this->writeRow($output, [...$values, ...$details]);
            }
            fclose($output);
        }, 'program-'.($risk ? 'risk' : 'activity').'-report-'.now()->format('Y-m-d_His').'.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function writeRow($output, array $values): void
    {
        $cells = array_map(function ($value) {
            $text = (string) $value;
            // Quote every cell and neutralize formula prefixes, including leading controls/whitespace.
            if (preg_match('/^[\s\p{Z}\x00-\x1F]*[=+\-@＝＋－＠]|^[\x00-\x1F]/u', $text)) {
                $text = "'".$text;
            }

            return '"'.str_replace('"', '""', $text).'"';
        }, $values);
        fwrite($output, implode(',', $cells)."\r\n");
    }
}
