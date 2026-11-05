import { mockApiFetch } from "./helpers/mockApiFetch.js";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { changeManagedUser, getUserManagementPrograms, getUserManagementUsers, getUserManagementUsersPage, userManagementPageCacheKey } from "../src/api/adminUserManagement.js";
import { filterUsers, paginateUsers, studentYearSection, userDepartment, userDisplayId, userErrorMessage, userPermissions } from "../src/pages/auth/admin/userManagementData.js";

const accounts = [
  { id: "s1", name: "Zoe Student", role: "student", status: "approved", school_id_number: "2026-001", program_id: "p1", year_level: "1st" },
  { id: "s2", name: "Amy Student", role: "student", status: "approved", program_id: "p2", year_level: "2nd" },
  { id: "staff1", name: "Ada Staff", email: "ada@laverdad.edu.ph", role: "instructor", status: "pending", program: { id: "p1", program_name: "BSIS" } },
  { id: "staff2", name: "Grace Staff", role: "program_head", status: "deactivated", program_id: "p1" },
];
const programs = [{ id: "p1", program_name: "BSIS" }, { id: "p2", program_name: "BSSW" }];

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "test-session" } });
  globalThis.window = new EventTarget();
});
afterEach(() => mock.restoreAll());

test("one user list includes every status and supports explicit status filters", () => {
  assert.deepEqual(filterUsers(accounts).map((user) => user.id), ["staff1", "s2", "staff2", "s1"]);
  assert.deepEqual(filterUsers(accounts, { status: "pending" }).map((user) => user.id), ["staff1"]);
  assert.deepEqual(filterUsers(accounts, { status: "deactivated" }).map((user) => user.id), ["staff2"]);
  assert.equal(filterUsers([{ ...accounts[3], status: "inactive" }], { status: "deactivated" }).length, 1);
});

test("role, program, and trimmed case-insensitive search combine", () => {
  assert.deepEqual(filterUsers(accounts, { role: "student", program: "p1", search: "  2026-001  " }, programs).map((user) => user.id), ["s1"]);
  assert.equal(filterUsers(accounts, { role: "student", program: "p1", search: "BSSW" }, programs).length, 0);
  assert.equal(filterUsers(accounts, { status: "pending", program: "p1", search: "ADA@LAVERDAD" }, programs).length, 1);
});

test("instructor program filter matches primary program rather than additional memberships", () => {
  const users = Array.from({ length: 20 }, (_, index) => ({
    id: `instructor-${index}`, name: `Instructor ${String(index).padStart(2, "0")}`,
    role: "instructor", status: "approved", program_id: index < 5 ? "p1" : "p2",
    programs: [{ id: "p1", program_name: "BSIS" }, { id: "p1", program_name: "BSIS" }],
  }));
  const outsider = { id: "outside", name: "Outside", role: "instructor", program_id: "p2", programs: null };
  const filtered = filterUsers([...users, outsider], { role: "instructor", program: "p1" }, programs);
  assert.equal(filtered.length, 5);
  assert.equal(new Set(filtered.map(user => user.id)).size, 5);
  assert.equal(paginateUsers(filtered).pageCount, 1);
  assert.equal(filterUsers(users, { role: "instructor", program: "p1", search: "Instructor 19", status: "approved" }, programs).length, 0);
  assert.equal(filterUsers([{ ...users[0], program_id: null, programs: [{ id: 42 }] }], { program: "42" }).length, 1);
  assert.equal(filterUsers([{ ...users[0], program_id: null, programs: [{ id: "p1" }, { id: "p2" }] }], { program: "p1" }).length, 0);
  assert.equal(filterUsers([{ ...users[0], program_id: 42 }], { program: "42" }).length, 1);
  assert.equal(filterUsers([outsider], { program: "p1" }).length, 0);
});

test("student year filtering combines with role, program and search without affecting staff views", () => {
  const users = [...accounts,
    { ...accounts[0], id: "third-year", name: "Alex Third", year_level: "3rd Year" },
    { ...accounts[0], id: "numeric-year", name: "Alex Numeric", year_level: 3 },
    { ...accounts[0], id: "unassigned-year", name: "Alex Unassigned", year_level: null },
  ];
  assert.deepEqual(filterUsers(users, { role: "student", year: "3", program: "p1", search: "Alex" }, programs).map(user => user.id), ["numeric-year", "third-year"]);
  assert.deepEqual(filterUsers(users, { role: "student", year: "unassigned" }, programs).map(user => user.id), ["unassigned-year"]);
  assert.equal(filterUsers(users, { role: "student", year: "4" }, programs).length, 0);
  assert.equal(filterUsers(users, { role: "instructor", status: "pending", year: "3" }, programs)[0].id, "staff1");
  assert.equal(filterUsers(users, { role: "student", year: "", program: "p1" }, programs).length, 4);
});

test("Program Head filter includes instructor accounts identified by either resource flag", () => {
  const users = [
    { id: "flag-head", name: "Flag Head", role: "instructor", status: "approved", heads_program: true },
    { id: "exists-head", name: "Exists Head", role: "instructor", status: "approved", headed_program_exists: true },
    { id: "literal-head", name: "Literal Head", role: "program_head", status: "approved" },
    { id: "ordinary", name: "Ordinary Instructor", role: "instructor", status: "approved", heads_program: false, headed_program_exists: false },
  ];
  assert.deepEqual(filterUsers(users, { role: "program_head" }).map((user) => user.id), ["exists-head", "flag-head", "literal-head"]);
  assert.equal(filterUsers(users, { role: "instructor" }).length, 3);
  assert.ok(users.every((user) => user.role === (user.id === "literal-head" ? "program_head" : "instructor")));
});

test("program relationship resolves instructor heads without a direct program or resource flag", () => {
  const head = { id: "head", name: "Program Leader", role: "instructor", status: "approved", program_id: null };
  const linkedPrograms = [{ id: "is", program_name: "BSIS", program_head_id: "head" }, { id: "sw", program_name: "BSSW", program_head_id: "other" }];
  assert.deepEqual(filterUsers([head], { role: "program_head", program: "is", search: "bsis" }, linkedPrograms), [head]);
  assert.equal(filterUsers([head], { role: "program_head", program: "sw" }, linkedPrograms).length, 0);
  assert.equal(userDepartment(head, linkedPrograms), "BSIS");
  assert.equal(userDepartment(head, linkedPrograms.slice(1)), "Unavailable");
});

test("head membership supports multiple programs and retains direct department precedence", () => {
  const head = { id: 42, name: "Head", role: "instructor", status: "approved" };
  const linkedPrograms = [{ id: "a", program_name: "BSIS", program_head_id: "42" }, { id: "b", program_name: "ACT", program_head_id: "42" }];
  assert.equal(userDepartment(head, linkedPrograms), "BSIS / ACT");
  assert.deepEqual(filterUsers([head], { program: "b" }, linkedPrograms), [head]);
  assert.equal(userDepartment({ ...head, program_id: "b" }, linkedPrograms), "ACT");
  assert.equal(userDepartment({ ...head, program: { id: "embedded", program_name: "Embedded Program" } }, linkedPrograms), "Embedded Program");
  assert.equal(userDepartment({}, [{ id: "unassigned", program_name: "Unassigned", program_head_id: null }]), "Unavailable");
});

test("program-head presentation does not change native role mutation permissions", async () => {
  const head = { id: "head", name: "Head", role: "instructor", status: "approved", heads_program: true };
  assert.deepEqual(userPermissions(head, "admin"), { changeRole: true, changeStatus: true });
  assert.deepEqual(userPermissions(head, "head"), { changeRole: false, changeStatus: false });
  const fetchMock = mockApiFetch(async (url, options) => {
    assert.ok(String(url).endsWith("/admin/users/head/role"));
    assert.deepEqual(JSON.parse(options.body), { role: "administrator" });
    return Response.json({ success: true, data: { ...head, role: "administrator" } });
  });
  await assert.rejects(changeManagedUser(head, "admin", "role", "instructor"), /not available/);
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal((await changeManagedUser(head, "admin", "role", "administrator")).role, "administrator");
});

test("filtered students list alphabetically across years and preserve supplied year and section", () => {
  assert.deepEqual(filterUsers(accounts, { role: "student" }).map((user) => user.id), ["s2", "s1"]);
  assert.equal(studentYearSection({ year_level: "3rd" }), "3rd");
  assert.equal(studentYearSection({ year_level: "3rd", section: "BSIS 3A" }), "3rd / BSIS 3A");
  assert.equal(studentYearSection({ section: " A " }), "A");
  assert.equal(studentYearSection({}), "Unassigned");
});

test("missing faculty and student IDs remain unavailable rather than showing database UUIDs", () => {
  assert.equal(userDisplayId(accounts[2]), "Unavailable");
  assert.equal(userDisplayId(accounts[1]), "Unassigned");
  assert.equal(userDisplayId(accounts[0]), "2026-001");
  assert.equal(userDisplayId({ role: "instructor", faculty_id: "FAC-100" }), "FAC-100");
  assert.equal(userDepartment(accounts[0], programs), "BSIS");
  assert.equal(userDepartment(accounts[2]), "BSIS");
  assert.equal(userDepartment({ program_id: "unknown" }, programs), "Unavailable");
  assert.equal(userDepartment({ role: "student", program_id: "unknown" }, programs), "Unassigned");
});

test("pagination displays ten accounts, clamps after filtering, and handles empty lists", () => {
  const users = Array.from({ length: 23 }, (_, id) => ({ id }));
  assert.equal(paginateUsers(users).rows.length, 10);
  assert.deepEqual(paginateUsers(users, 2).rows.map((user) => user.id), [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  assert.equal(paginateUsers(users, 9).page, 3);
  assert.equal(paginateUsers(users, -3).page, 1);
  assert.equal(paginateUsers(users.slice(0, 2), 3).page, 1);
  assert.deepEqual(paginateUsers([]), { rows: [], page: 1, pageCount: 1, start: 0, total: 0 });
});

test("self accounts, unknown sessions, and students cannot receive inappropriate mutations", () => {
  assert.deepEqual(userPermissions(accounts[2], "staff1"), { changeRole: false, changeStatus: false });
  assert.deepEqual(userPermissions(accounts[2], null), { changeRole: false, changeStatus: false });
  assert.deepEqual(userPermissions(accounts[0], "admin"), { changeRole: false, changeStatus: true });
  assert.deepEqual(userPermissions(accounts[2], "admin"), { changeRole: true, changeStatus: false });
});

test("user listing follows bounded collection metadata before local search or pagination", async () => {
  const pages = [];
  mockApiFetch(async (url) => {
    const parsed = new URL(url, "https://example.test");
    pages.push(parsed);
    const page = Number(parsed.searchParams.get("page"));
    return Response.json({ success: true, data: page === 1 ? Array.from({ length: 100 }, (_, index) => ({ id: `user-${index}`, name: `User ${index}`, role: "instructor", status: "approved" })) : [{ id: "last-user", name: "Last User", role: "instructor", status: "approved" }], meta: { page, per_page: 100, total: 101, last_page: 2 } });
  });
  const users = await getUserManagementUsers();
  assert.equal(users.length, 101);
  assert.equal(filterUsers(users, { search: "Last User" })[0].id, "last-user");
  assert.deepEqual(pages.map((url) => url.searchParams.get("page")), ["1", "2"]);
  assert.ok(pages.every((url) => url.pathname === "/api/admin/users" && url.searchParams.get("per_page") === "100"));
});

test("user management loads only the requested server page with supported filters", async () => {
  const controller = new AbortController();
  let request;
  mockApiFetch(async (url, options) => {
    request = { url: new URL(url, "https://example.test"), options };
    return Response.json({ success: true, data: [{ id: "visible-user" }], meta: { page: 2, per_page: 10, total: 21, last_page: 3 } });
  });

  const result = await getUserManagementUsersPage({
    page: 2,
    perPage: 10,
    filters: { search: "  Ada  ", status: "approved", role: "student", program: "p1", year: "3" },
    signal: controller.signal,
  });

  assert.deepEqual(result, { data: [{ id: "visible-user" }], meta: { page: 2, per_page: 10, total: 21, last_page: 3 } });
  assert.equal(request.options.signal, controller.signal);
  assert.equal(request.url.pathname, "/api/admin/users");
  assert.deepEqual(Object.fromEntries(request.url.searchParams), {
    search: "Ada", status: "approved", role: "student", program_id: "p1", year_level: "3rd", page: "2", per_page: "10",
  });
});

test("user management omits blank filters and does not silently send unsupported unassigned years", async () => {
  const requests = [];
  mockApiFetch(async (url) => {
    requests.push(new URL(url, "https://example.test"));
    return Response.json({ success: true, data: [], meta: { page: 1, per_page: 10, total: 0, last_page: 1 } });
  });

  await getUserManagementUsersPage({ filters: { search: " ", status: "", role: "", program: "", year: "" } });
  assert.throws(() => getUserManagementUsersPage({ filters: { year: "unassigned" } }), /not supported/);
  assert.deepEqual(Object.fromEntries(requests[0].searchParams), { page: "1", per_page: "10" });
  assert.equal(requests.length, 1);
});

test("user management cache keys are stable per server page and normalized filter set", () => {
  const filters = { search: " Ada ", status: "approved", role: "student", program: "p1", year: "3" };
  assert.equal(userManagementPageCacheKey(2, filters), userManagementPageCacheKey(2, { ...filters, search: "Ada" }));
  assert.notEqual(userManagementPageCacheKey(1, filters), userManagementPageCacheKey(2, filters));
  assert.notEqual(userManagementPageCacheKey(2, filters), userManagementPageCacheKey(2, { ...filters, status: "deactivated" }));
});

test("user management receives out-of-range metadata so the page can recover to the last page", async () => {
  mockApiFetch(async () => Response.json({
    success: true, data: [], meta: { page: 99, per_page: 10, total: 12, last_page: 2 },
  }));
  assert.deepEqual(await getUserManagementUsersPage({ page: 99 }), {
    data: [], meta: { page: 99, per_page: 10, total: 12, last_page: 2 },
  });
});

test("failure on a later collection page does not publish a truncated list", async () => {
  mockApiFetch(async (url) => {
    const page = new URL(url, "https://example.test").searchParams.get("page");
    return page === "1"
      ? Response.json({ success: true, data: Array.from({ length: 100 }, (_, id) => ({ id })), meta: { page: 1, per_page: 100, total: 101, last_page: 2 } })
      : Response.json({ message: "Second page unavailable" }, { status: 503 });
  });
  await assert.rejects(getUserManagementUsers(), /Second page unavailable/);
});

test("program list uses the same complete collection reader", async () => {
  let requested;
  mockApiFetch(async (url) => {
    requested = String(url);
    return Response.json({ success: true, data: programs, meta: { page: 1, per_page: 100, total: 2, last_page: 1 } });
  });
  assert.deepEqual(await getUserManagementPrograms(), programs);
  assert.ok(requested.includes("/api/admin/programs?"));
});

test("pending roster entries cannot issue status mutations", async () => {
  const fetch = mockApiFetch(async () => { throw new Error("Unexpected mutation"); });
  await assert.rejects(changeManagedUser(accounts[2], "admin", "status", "approved"), /not available/);
  await assert.rejects(changeManagedUser(accounts[2], "admin", "status", "deactivated"), /not available/);
  assert.equal(fetch.mock.callCount(), 0);
});

test("status actions require a confirmed resource and never fabricate success from empty HTTP 200", async () => {
  mockApiFetch(async () => Response.json({ success: true, data: null }));
  await assert.rejects(changeManagedUser(accounts[3], "admin", "status", "approved"), /did not confirm/);
});

test("role assignment preserves account status and uses the existing staff endpoint", async () => {
  const updated = { ...accounts[2], role: "program_head" };
  mockApiFetch(async (url, options) => {
    assert.ok(String(url).endsWith("/admin/users/staff1/role"));
    assert.equal(options.method, "PATCH");
    assert.deepEqual(JSON.parse(options.body), { role: "program_head" });
    return Response.json({ success: true, data: updated });
  });
  assert.deepEqual(await changeManagedUser(accounts[2], "admin", "role", "program_head"), updated);
});

test("self changes and student role changes issue no requests", async () => {
  const fetchMock = mockApiFetch(async () => { throw new Error("Unexpected mutation"); });
  await assert.rejects(changeManagedUser(accounts[2], "staff1", "role", "administrator"), /not available/);
  await assert.rejects(changeManagedUser(accounts[2], "staff1", "status", "approved"), /not available/);
  await assert.rejects(changeManagedUser(accounts[0], "admin", "role", "instructor"), /not available/);
  await assert.rejects(changeManagedUser(accounts[2], "admin", "role", "student"), /not available/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("deactivation and reactivation require matching server status and resource identity", async () => {
  mockApiFetch(async (url, options) => {
    const account = String(url).includes("staff2") ? accounts[3] : String(url).includes("staff1") ? accounts[2] : accounts[0];
    return Response.json({ success: true, data: { ...account, status: JSON.parse(options.body).status } });
  });
  assert.equal((await changeManagedUser(accounts[0], "admin", "status", "deactivated")).status, "deactivated");
  await assert.rejects(changeManagedUser(accounts[2], "admin", "status", "deactivated"), /not available/);
  assert.equal((await changeManagedUser(accounts[3], "admin", "status", "approved")).status, "approved");
  mockApiFetch(async () => Response.json({ success: true, data: { ...accounts[0], status: "approved" } }));
  await assert.rejects(changeManagedUser(accounts[3], "admin", "status", "approved"), /did not confirm/);
});

test("validation errors retain server field feedback", () => {
  assert.equal(userErrorMessage({ message: "Invalid input", errors: { role: ["Role is unavailable."] } }), "Role is unavailable.");
});
