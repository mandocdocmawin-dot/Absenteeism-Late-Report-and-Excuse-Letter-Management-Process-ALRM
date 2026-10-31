import { getInstructorDashboard } from "@/api/instructor";
import { apiFetch, ApiError } from "@/api/client";
import { buildClassRecords } from "../InstructorClassRecords/recordData";
import { requestCourse, submittedDate } from "../InstructorRequests/requestData";
import { formatSchedule } from "../../student/request-form/utils";

const schoolDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });
const total = value => Number.isInteger(value) && value >= 0 ? value : null;

function dayKey(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : schoolDay.format(new Date(value));
}

function reported(records) {
  const unique = new Map();
  for (const record of records) {
    if (record?.id && ["absence", "late"].includes(record.type) && record.status !== "cancelled") unique.set(String(record.id), record);
  }
  return [...unique.values()];
}

export async function loadInstructorReports() {
  const records = [];
  let page = 1;
  let lastPage = 1;
  do {
    const response = await apiFetch(`/api/instructor/requests?page=${page}&per_page=100`);
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(payload?.message || "The request reports could not be loaded.", response.status);
    if (payload?.success !== true || !Array.isArray(payload.data)) throw new Error("The server returned an unexpected instructor requests response.");
    records.push(...payload.data);
    if (payload.meta != null) {
      if (payload.meta.page !== page || !Number.isInteger(payload.meta.last_page) || payload.meta.last_page < page) throw new Error("The server returned unexpected request pagination.");
      lastPage = payload.meta.last_page;
    }
    page += 1;
  } while (page <= lastPage);
  return records;
}

export async function loadInstructorSnapshot() {
  const dashboard = await getInstructorDashboard();
  if (!dashboard || !Array.isArray(dashboard.pending_requests) || !Array.isArray(dashboard.flagged_students)) {
    throw new Error("The server returned an unexpected instructor dashboard response.");
  }
  return dashboard;
}

export async function loadInstructorOverview() {
  const [dashboard, requests] = await Promise.all([loadInstructorSnapshot(), loadInstructorReports()]);
  return { dashboard, requests };
}

export function buildInstructorOverview(dashboard, requests, now = new Date(), weekOffset = 0) {
  const todayKey = dayKey(now);
  const monday = new Date(`${todayKey}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7 + weekOffset * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const week = { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10), hasPrevious: false, hasNext: weekOffset < 0 };
  const dateOptions = { timeZone: "UTC", month: "short", day: "numeric" };
  week.label = `${monday.toLocaleDateString("en-US", dateOptions)} - ${sunday.toLocaleDateString("en-US", { ...dateOptions, year: "numeric" })}`;
  const records = reported(requests);
  const today = { absences: 0, lates: 0 };
  const weekly = new Map();
  const sources = new Map();
  for (const record of records) {
    const key = record.type === "absence" ? "absences" : "lates";
    const day = dayKey(submittedDate(record));
    if (day === todayKey) today[key] += 1;
    if (day && day < week.start) week.hasPrevious = true;
    const course = requestCourse(record);
    if (!course?.id) continue;
    sources.set(course.id, course);
    if (!weekly.has(course.id)) weekly.set(course.id, { absences: 0, lates: 0 });
    if (day && day >= week.start && day <= week.end && day <= todayKey) weekly.get(course.id)[key] += 1;
  }
  const courses = buildClassRecords(records).map(course => {
    const source = sources.get(course.id);
    return {
      ...course,
      schedule: formatSchedule(source.schedule) || "Not provided",
      term: [source.semester && `${source.semester} Semester`, source.school_year].filter(Boolean).join(" / "),
      absences: course.students.reduce((sum, student) => sum + student.absences, 0),
      lates: course.students.reduce((sum, student) => sum + student.lates, 0),
      weeklyAbsences: weekly.get(course.id)?.absences || 0,
      weeklyLates: weekly.get(course.id)?.lates || 0,
    };
  });
  const pendingReports = reported(dashboard.pending_requests || []).filter(record => record.status === "pending");
  const pending = { absences: 0, lates: 0, total: pendingReports.length };
  for (const record of pendingReports) pending[record.type === "absence" ? "absences" : "lates"] += 1;
  return { totalStudents: total(dashboard.total_students), totalClasses: total(dashboard.total_classes), today, pending, courses, week, flags: (dashboard.flagged_students || []).filter(flag => flag && ["warning", "IR"].includes(flag.status)) };
}
