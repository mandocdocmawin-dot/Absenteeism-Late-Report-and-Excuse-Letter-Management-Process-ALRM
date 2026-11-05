import assert from "node:assert/strict";
import test from "node:test";
import { cancelResourceRequest, clearResourceCache, requestCachedResource, resourceCacheSnapshot } from "../src/api/resourceCache.js";

test("a page can cancel its superseded cached request without invalidating settled data", async () => {
  let aborted = false;
  const pending = requestCachedResource("users:old-page", (signal) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => {
      aborted = true;
      reject(Object.assign(new Error("cancelled"), { name: "AbortError" }));
    });
  }));

  await Promise.resolve();
  assert.equal(cancelResourceRequest("users:old-page"), true);
  await assert.rejects(pending, /cancelled/);
  assert.equal(aborted, true);
  assert.equal(resourceCacheSnapshot().inFlight, 0);
  assert.equal(cancelResourceRequest("users:old-page"), false);
  clearResourceCache();
});
