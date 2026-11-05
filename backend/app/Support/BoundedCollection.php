<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

final class BoundedCollection
{
    public static function respond(Builder $query, ?string $resource = null): JsonResponse
    {
        $input = request()->validate([
            'page' => ['sometimes', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        $meta = null;
        if ($input !== []) {
            $paginator = $query->paginate($input['per_page'] ?? 50);
            $items = $paginator->getCollection();
            $meta = [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ];
        } else {
            // Keep legacy arrays intact without silently omitting records.
            $items = $query->limit(501)->get();
            abort_if($items->count() > 500, 422,
                'Too many records. Request a page using page and per_page (maximum 100).');
        }

        return response()->json([
            'success' => true,
            'message' => null,
            'data' => $resource ? $resource::collection($items) : $items,
            'meta' => $meta,
        ]);
    }
}
