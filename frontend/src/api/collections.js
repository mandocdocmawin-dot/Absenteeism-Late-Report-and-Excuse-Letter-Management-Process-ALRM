import { apiFetch, ApiError } from "./client.js";

function collectionEndpoint(path, page, perPage) {
  const [pathname, search = ""] = path.split("?");
  const query = new URLSearchParams(search);
  query.set("page", String(page));
  query.set("per_page", String(perPage));
  const endpoint = pathname.startsWith("/api/") ? pathname : `/api${pathname}`;
  return `${endpoint}?${query}`;
}

export async function getCollectionPage(path, { signal, page = 1, perPage = 10 } = {}) {
  const response = await apiFetch(collectionEndpoint(path, page, perPage), { signal });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) throw new ApiError(payload?.message || "Could not load records.", response.status, payload?.errors);
  if (!Array.isArray(payload?.data)) throw new Error("The server returned an unexpected collection.");
  if (payload.meta != null && (payload.meta.page !== page || !Number.isInteger(payload.meta.last_page) || payload.meta.last_page < page)) {
    throw new Error("The server returned unsupported pagination.");
  }
  return { data: payload.data, meta: payload.meta || null };
}

export async function getCollection(path, { signal, perPage = 100 } = {}) {
  const [pathname, search = ""] = path.split("?");
  const query = new URLSearchParams(search);
  const records = [];
  let lastPage = 1;
  for (let page = 1; page <= lastPage; page++) {
    const { data, meta } = await getCollectionPage(`${pathname}?${query}`, { signal, page, perPage });
    if (meta != null) {
      if (meta.last_page > 1000) throw new Error("The server returned unsupported pagination. Please narrow the records requested.");
      lastPage = meta.last_page;
    }
    records.push(...data);
  }
  return records;
}
