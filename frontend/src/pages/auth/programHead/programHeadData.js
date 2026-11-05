import { historicalInstructor, historicalRequestClass } from "../../../lib/requestHistory.js";

export function requestDate(request) {
  const value = request.date_submitted || request.created_at;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function requestStudent(request) {
  return request.enrollment?.student?.name || "Student unavailable";
}

export function requestClass(request) {
  return historicalRequestClass(request);
}

export function instructorRows(requests) {
  const rows = new Map();
  for (const request of requests) {
    const classRecord = requestClass(request);
    const instructor = historicalInstructor(classRecord);
    if (!instructor?.id) continue;
    if (!rows.has(instructor.id)) rows.set(instructor.id, {
      id: instructor.id, name: instructor.name || "Instructor", classes: new Map(), absences: 0, lates: 0,
    });
    const row = rows.get(instructor.id);
    if (classRecord?.id) row.classes.set(classRecord.id, classRecord);
    if (request.type === "absence") row.absences += 1;
    if (request.type === "late") row.lates += 1;
  }
  return [...rows.values()].map((row) => ({ ...row, classes: [...row.classes.values()] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function monthlyActivity(requests, months = 6, now = new Date()) {
  const entries = Array.from({ length: months }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - months + index + 1, 1);
    return { key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleString("en", { month: "short" }), absences: 0, lates: 0 };
  });
  const byMonth = new Map(entries.map((entry) => [entry.key, entry]));
  for (const request of requests) {
    const date = requestDate(request);
    const month = date && byMonth.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (month && request.type === "absence") month.absences += 1;
    if (month && request.type === "late") month.lates += 1;
  }
  return entries;
}

export function withinDates(date, from, to) {
  if (!date || Number.isNaN(date.getTime())) return !from && !to;
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return (!from || day >= from) && (!to || day <= to);
}

export function filterReportRows(records, from, to, getDate) {
  return records.filter((record) => withinDates(getDate(record), from, to));
}

export function formatRiskPercentage(value) {
  if (value === null || value === undefined || value === "") return "Unavailable";
  const percentage = Number(value);
  if (!Number.isFinite(percentage)) return "Unavailable";
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(percentage)}%`;
}
