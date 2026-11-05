<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>Your ALRM verification code</title>
</head>
<body style="margin:0; padding:0; background-color:#eef1f5; font-family:Arial, Helvetica, sans-serif;">
<div style="display:none!important; visibility:hidden; mso-hide:all; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    Your ALRM verification code is {{ $code }}. It expires in {{ $expiresInMinutes ?? 5 }} minutes.
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f5; padding:32px 12px;">
    <tr>
        <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 18px rgba(15,32,67,0.08);">

                {{-- Header --}}
                <tr>
                    @include('mail.partials.header')
                </tr>

                {{-- Body --}}
                <tr>
                    <td style="padding:36px 40px 8px;">
                        <h1 style="margin:0 0 8px; font-family:Arial, Helvetica, sans-serif; font-size:20px; color:#0b2a52;">
                            Please verify your identity, {{ $name }}
                        </h1>
                        <p style="margin:0 0 24px; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#4a5568;">
                            Use this one-time verification code to complete your ALRM sign-in.
                        </p>
                    </td>
                </tr>

                {{-- OTP Code Box --}}
                <tr>
                    <td align="center" style="padding:0 40px 24px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f7fb; border:1px dashed #164a86; border-radius:10px;">
                            <tr>
                                <td align="center" style="padding:22px 16px;">
                                    <p style="margin:0 0 12px; font-family:Arial, Helvetica, sans-serif; font-size:14px; color:#4a5568;">Your ALRM verification code:</p>
                                    <p style="margin:0; font-family:'Courier New', Courier, monospace; font-size:34px; line-height:1.3; font-weight:bold; letter-spacing:4px; white-space:nowrap; -webkit-user-select:all; user-select:all; color:#0b2a52;">{{ $code }}</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                {{-- Expiry / Notes --}}
                <tr>
                    <td style="padding:0 40px 8px;">
                        <p style="margin:0 0 10px; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#4a5568;">
                            This code expires in approximately <strong>{{ $expiresInMinutes ?? 5 }} minutes</strong> and can only be used once.
                            @isset($expiresAtUtc)
                                Valid until {{ $expiresAtUtc }}.
                            @endisset
                        </p>
                        <p style="margin:0 0 28px; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#6b7385;">
                            If you did not request this code, you can safely ignore this email — no changes will be made to your account.
                        </p>
                    </td>
                </tr>

                <tr>
                    <td style="padding:0 40px;">
                        <hr style="border:none; border-top:1px solid #e6e9f0; margin:0 0 24px;">
                    </td>
                </tr>

                {{-- Authentication-specific footer --}}
                <tr>
                    <td style="padding:0 40px 32px; font-family:Arial, Helvetica, sans-serif;">
                        <p style="margin:0 0 8px; font-size:14px; font-weight:bold; color:#0b2a52;">Do not share this code with anyone.</p>
                        <p style="margin:0; font-size:12px; line-height:1.6; color:#4a5568;">ALRM will never ask you to send this code by email or message. Enter it only on the ALRM sign-in page.</p>
                    </td>
                </tr>

            </table>

            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">
                <tr>
                    <td align="center" style="padding:20px 12px 0;">
                        <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:11px; color:#6b7385;">
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
