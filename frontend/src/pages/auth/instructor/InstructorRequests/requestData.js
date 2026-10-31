import { programShortName } from "../../../../lib/programs.js";
import { historicalRequestClass } from "../../../../lib/requestHistory.js";

export const requestStatuses = ["pending", "approved", "noted", "invalid", "cancelled"];
export const submittedDate = request => request.date_submitted || request.created_at || null;
export const occurrenceDate = request => request.type === "absence" ? request.start_date_of_absence || null : null;
export const requestCourse = request => historicalRequestClass(request);
export function dueDate(request) {
  const value = submittedDate(request);
  if (!value) return null;
  const submitted = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  const deadline = new Date(submitted.getTime() + 48 * 60 * 60 * 1000);
  return Number.isNaN(deadline.getTime()) ? null : deadline.toISOString();
}

export function formatDate(value) {
  if (!value) return "Unavailable";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function classLabel(course) {
  const program = course?.program;
  return [course?.subject_name || "Subject unavailable", program?.program_code || programShortName(program?.program_name), course?.year_level && `Year ${course.year_level}`, course?.section && `Section ${course.section}`].filter(Boolean).join(" - ");
}

export function filterRequests(records, { type = "absence", subject = "", status = "", search = "" } = {}) {
  const name = search.slice(0, 50).trim().toLowerCase();
  const timestamp = record => Date.parse(submittedDate(record)) || 0;
  return records.filter(record => record?.id != null && record.type === type &&
    (!subject || String(requestCourse(record)?.id) === subject) &&
    (!status || record.status === status) &&
    (!name || String(record.enrollment?.student?.name || "").toLowerCase().includes(name)))
    .sort((a, b) => timestamp(b) - timestamp(a) || String(a.id).localeCompare(String(b.id)));
}

export function groupRequests(records) {
  const groups = new Map();
  for (const record of records) {
    const course = requestCourse(record);
    const id = course?.id == null ? "" : String(course.id);
    if (!groups.has(id)) groups.set(id, { id, course, label: classLabel(course), records: [] });
    groups.get(id).records.push(record);
  }
  return [...groups.values()];
}

export function requestCourses(records, programs = []) {
  return groupRequests(records).filter(group => group.id).map(({ id, course }) => {
    const program = course.program || programs.find(item => String(item.id) === String(course.program_id));
    const year = String(course.year_level ?? "").trim();
    return {
      id,
      subjectName: course.subject_name || "Subject unavailable",
      program: program?.program_code || program?.code || programShortName(program?.program_name) || "Unavailable",
      year: year.match(/^([1-4])(?:st|nd|rd|th)?(?:\s+year)?$/i)?.[1] || year || "Unavailable",
      section: course.section || "",
    };
  }).sort((a, b) => a.subjectName.localeCompare(b.subjectName) || a.program.localeCompare(b.program) || a.year.localeCompare(b.year) || a.section.localeCompare(b.section) || a.id.localeCompare(b.id));
}

export function updateRequestParams(params, changes) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  return next;
}
