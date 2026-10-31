import assert from "node:assert/strict";
import test from "node:test";
import { paginateRecords } from "../src/pages/auth/student/records/pagination.js";

const records = Array.from({ length: 17 }, (_, id) => ({ id }));

test("records are fixed at ten per page with the remainder on the next", () => {
  const first = paginateRecords(records, 1);
  const next = paginateRecords(records, first.currentPage + 1);
  assert.equal(first.totalPages, 2);
  assert.deepEqual(first.pageRecords, records.slice(0, 10));
  assert.deepEqual(next.pageRecords, records.slice(10));
  assert.equal(next.firstRecord, 10);
  assert.deepEqual(paginateRecords(records, next.currentPage - 1).pageRecords, first.pageRecords);
});

test("empty results and out-of-range pages stay within valid boundaries", () => {
  const empty = paginateRecords([], 20);
  assert.equal(empty.currentPage, 1);
  assert.equal(empty.totalPages, 1);
  assert.deepEqual(empty.pageRecords, []);
  assert.equal(paginateRecords(records, -1).currentPage, 1);
  assert.equal(paginateRecords(records, 20).currentPage, 2);
});

test("fewer than ten records fit on one page and filters clamp the selected page", () => {
  const shorter = records.slice(0, 7);
  const single = paginateRecords(shorter, 2);
  assert.equal(single.currentPage, 1);
  assert.deepEqual(single.pageRecords, shorter);
  const filtered = paginateRecords(records.filter((item) => item.id < 3), 2);
  assert.equal(filtered.currentPage, 1);
  assert.equal(filtered.pageRecords.length, 3);
});

test("page number buttons remain bounded when navigating a long list", () => {
  const many = Array.from({ length: 120 }, (_, id) => ({ id }));
  assert.deepEqual(paginateRecords(many, 1).pageButtons, [1, 2, 3, 4, 5]);
  assert.deepEqual(paginateRecords(many, 7).pageButtons, [5, 6, 7, 8, 9]);
  assert.deepEqual(paginateRecords(many, 12).pageButtons, [8, 9, 10, 11, 12]);
});
