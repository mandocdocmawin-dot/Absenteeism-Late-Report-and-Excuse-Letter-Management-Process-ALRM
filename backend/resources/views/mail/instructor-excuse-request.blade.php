<!DOCTYPE html>
<html lang="fil">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Excuse Request</title>
</head>

<body style="margin:0; padding:0; background-color:#eef1f5; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f5; padding:32px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 18px rgba(15,32,67,0.08);">
                    <tr>
                        @include('mail.partials.header')
                    </tr>
                    <tr>
                        <td style="padding:36px 24px 8px;">
                            <p style="margin:0 0 12px; font-size:12px; letter-spacing:1.5px; text-transform:uppercase; color:#164a86; font-weight:bold;">New Excuse Request</p>
                            <h1 style="margin:0 0 8px; font-size:20px; color:#0b2a52;">Hello {{ $instructor->name }},</h1>
                            <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#4a5568;">May bagong <strong>{{ $excuseRequest->type === 'late' ? 'late' : 'absence' }}</strong> excuse request na naghihintay ng review mo.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 24px 24px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fb; border:1px dashed #164a86; border-radius:10px;">
                                <tr>
                                    <td style="padding:22px 20px; font-size:14px; line-height:1.6; color:#4a5568; overflow-wrap:anywhere; word-break:break-word;">
                                        <p style="margin:0 0 12px;"><strong style="color:#0b2a52;">Student</strong><br>{{ $student->name }}</p>
                                        <p style="margin:0 0 12px;"><strong style="color:#0b2a52;">Program and Year Level</strong><br>{{ $excuseRequest->class_snapshot['program']['program_name'] ?? $class->program?->program_name ?? '—' }} — {{ $excuseRequest->class_snapshot['year_level'] ?? $class->year_level ?? '—' }}</p>
                                        <p style="margin:0 0 12px;"><strong style="color:#0b2a52;">Subjects missed</strong><br>{{ $excuseRequest->subjects_missed }}</p>
                                        @if($excuseRequest->type === 'late')
                                        <p style="margin:0 0 12px;"><strong style="color:#0b2a52;">Minutes late</strong><br>{{ $excuseRequest->minutes_late }}</p>
                                        @else
                                        <p style="margin:0 0 12px;"><strong style="color:#0b2a52;">Date of absence</strong><br>{{ $excuseRequest->start_date_of_absence?->format('M d, Y') }}@if($excuseRequest->end_date_of_absence && ! $excuseRequest->end_date_of_absence->isSameDay($excuseRequest->start_date_of_absence)) to {{ $excuseRequest->end_date_of_absence->format('M d, Y') }}@endif</p>
                                        @endif
                                        <p style="margin:0;"><strong style="color:#0b2a52;">Reason</strong><br>{!! nl2br(e($excuseRequest->reason)) !!}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding:0 24px 24px;">
                            <table role="presentation" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" bgcolor="#164a86" style="border-radius:6px;">
                                        <a href="{{ $reviewUrl }}" style="display:inline-block; padding:15px 30px; border:1px solid #164a86; border-radius:6px; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none;">Review Request</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 24px;">
                            <hr style="border:none; border-top:1px solid #e6e9f0; margin:0 0 24px;">
                        </td>
                    </tr>
                    <tr>
                        @include('mail.partials.footer')
                    </tr>

                </table>

                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">
                    <tr>
                        <td align="center" style="padding:20px 12px 0;">
                            <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:11px; color:#9aa3b2;">
                                ALRM &middot; Attendance and Excuse Request Management
                            </p>
                        </td>
                    </tr>
                </table>

            </td>
        </tr>
    </table>
</body>

</html>
