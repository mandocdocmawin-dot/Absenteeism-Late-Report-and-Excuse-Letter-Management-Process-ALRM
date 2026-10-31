<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\RequestAttachment;
use App\Models\User;
use App\Support\EvidenceImageProcessor;
use App\Support\EvidencePdfValidator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class EvidenceController extends Controller
{
    public function store(Request $request)
    {
        abort_unless($request->user()?->role === 'student', 403);
        $request->validate([
            'file' => ['bail', 'required', 'file', 'mimes:pdf,jpg,jpeg,png',
                'mimetypes:application/pdf,image/jpeg,image/png',
                'extensions:pdf,jpg,jpeg,png', 'max:2048'],
        ]);

        $file = $request->file('file');
        $mime = $file->getMimeType();
        $extension = strtolower($file->getClientOriginalExtension());
        $allowedExtensions = [
            'application/pdf' => ['pdf'],
            'image/jpeg' => ['jpg', 'jpeg'],
            'image/png' => ['png'],
        ];
        if (! in_array($extension, $allowedExtensions[$mime] ?? [], true)) {
            throw ValidationException::withMessages(['file' => 'The file extension does not match its contents.']);
        }

        $data = file_get_contents($file->getRealPath());
        if ($data === false || $data === '') {
            throw ValidationException::withMessages(['file' => 'The file is empty or unreadable.']);
        }

        if ($mime === 'application/pdf') {
            try {
                EvidencePdfValidator::validate($file->getRealPath());
            } catch (InvalidArgumentException $error) {
                throw ValidationException::withMessages(['file' => $error->getMessage()]);
            }
        } else {
            try {
                $data = EvidenceImageProcessor::process($data, $mime);
            } catch (InvalidArgumentException $error) {
                throw ValidationException::withMessages(['file' => $error->getMessage()]);
            }
            $mime = 'image/jpeg';
        }

        $name = basename(str_replace('\\', '/', $file->getClientOriginalName()));
        $name = preg_replace('/[\x00-\x1F\x7F]/u', '', $name) ?: 'attachment';
        $name = pathinfo($name, PATHINFO_FILENAME);
        $name = mb_substr($name, 0, 240).($mime === 'application/pdf' ? '.pdf' : '.jpg');

        $attachment = DB::transaction(function () use ($request, $name, $mime, $data) {
            User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            $pending = RequestAttachment::where('user_id', $request->user()->id)
                ->whereNull('excuse_request_id')->count();
            if ($pending >= 10) {
                throw ValidationException::withMessages([
                    'file' => 'Too many unused uploads. Please contact support to clear them.',
                ]);
            }
            return RequestAttachment::create([
                'user_id' => $request->user()->id,
                'original_name' => $name,
                'mime_type' => $mime,
                'size' => strlen($data),
                'data' => $data,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'File uploaded.',
            'data' => [
                'path' => $attachment->id,
                'name' => $attachment->original_name,
                'type' => $attachment->mime_type,
            ],
        ], 201);
    }
}
