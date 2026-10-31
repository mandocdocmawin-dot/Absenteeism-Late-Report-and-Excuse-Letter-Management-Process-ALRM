<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Request Update</title>
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
                        <p style="margin:0 0 12px; font-size:12px; letter-spacing:1.5px; text-transform:uppercase; color:#164a86; font-weight:bold;">Request Update</p>
                        <h1 style="margin:0 0 8px; font-size:20px; color:#0b2a52;">Hello {{ $student->name }},</h1>
                        <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#4a5568;">
                            Your instructor has taken action on your <strong>{{ $excuseRequest->type === 'late' ? 'late' : 'absence' }}</strong> excuse request for <strong>{{ $excuseRequest->class_snapshot['subject_name'] ?? $class->subject_name }}</strong>. Please click the button below to view the details.
                        </p>
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding:0 24px 24px;">
                        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#164a86" style="border-radius:6px;">
                            <a href="{{ $viewUrl }}" style="display:inline-block; padding:15px 30px; border:1px solid #164a86; border-radius:6px; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none;">View Request</a>
                        </td></tr></table>
                    </td>
                </tr>
                <tr><td style="padding:0 24px;"><hr style="border:none; border-top:1px solid #e6e9f0; margin:0 0 24px;"></td></tr>
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
