import { classLabel, dueDate, formatDate, occurrenceDate, requestCourse, submittedDate } from "./requestData";

export function csvCell(value) {
  const text = String(value ?? "");
  const safe = /^[=+@-]/.test(text.trimStart()) || ["\t", "\r", "\n"].includes(text[0]) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function requestsCsv(records) {
  const rows = [["Class", "Student", "Date of Occurrence", "Type", "Submitted", "Date of Due", "Request"]];
  for (const record of records) rows.push([
    classLabel(requestCourse(record)), record.enrollment?.student?.name || "Unavailable",
    formatDate(occurrenceDate(record)), record.type, formatDate(submittedDate(record)),
    formatDate(dueDate(record)), record.status,
  ]);
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}

export function exportRequests(records) {
  const url = URL.createObjectURL(new Blob(["\uFEFF", requestsCsv(records)], { type: "text/csv;charset=utf-8" }));
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "class-requests.csv";
    anchor.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
