import { requestReason } from "../request-form/buildPayload.js";
import { historicalRequestClass } from "../../../../lib/requestHistory.js";

export function subjectOf(record) {
  return historicalRequestClass(record)?.subject_name || record.subjects_missed || "Unknown subject";
}

export function typeOf(record) {
  return record.type === "absence" ? "Absent" : record.type === "late" ? "Late" : "Unknown";
}

export function recordDate(record) {
  return record.type === "absence"
    ? record.start_date_of_absence || record.date_submitted || record.created_at
    : record.date_submitted || record.created_at;
}

export function reviewStatus(value) {
  const labels = { pending: "Pending", approved: "Approved", noted: "Noted", invalid: "Invalid", cancelled: "Cancelled" };
  return labels[value] || value || "\u2014";
}

export function reasonOf(record) {
  return requestReason(record) || "No reason provided.";
}

export function filterRecords(records, type, search = "", subject = "") {
  const query = search.trim().toLowerCase();
  return records.filter((record) => {
    const name = subjectOf(record);
    return record.type === type && (!subject || name === subject)
      && (!query || `${name} ${reviewStatus(record.status)} ${typeOf(record)} ${reasonOf(record)}`.toLowerCase().includes(query));
  }).sort((a, b) => String(recordDate(b) || "").localeCompare(String(recordDate(a) || "")));
}
