import { historicalRequestClass } from "../../../../lib/requestHistory.js";
export { programShortName } from "../../../../lib/programs.js";

export function studentProfile(user, classes = []) {
  const sections = [...new Set(classes.map((item) => item.section).filter(Boolean))];
  const terms = [...new Set(classes.filter((item) => item.semester && item.school_year)
    .map((item) => `${item.semester} Semester A.Y. ${item.school_year}`))];
  const year = user?.year_level ? `${user.year_level} Year` : "";
  return {
    name: user?.name || "Student",
    studentId: user?.school_id_number || "Not available",
    program: user?.program?.program_name || "Not assigned",
    academic: [user?.program?.program_name, year, sections.length ? `Section ${sections.join(", ")}` : ""].filter(Boolean).join(" - ") || "Not assigned",
    term: terms.join(" / "),
  };
}

export function requestTotals(requests = []) {
  const recorded = requests.filter((item) => item.status !== "cancelled");
  const absences = recorded.filter((item) => item.type === "absence");
  return {
    absences: absences.length,
    lates: recorded.filter((item) => item.type === "late").length,
    excused: absences.filter((item) => ["approved", "noted"].includes(item.status)).length,
    unexcused: absences.filter((item) => item.status === "invalid").length,
    pending: absences.filter((item) => item.status === "pending").length,
  };
}

export function recentRequestActivity(requests = [], limit = 5) {
  return requests.flatMap((item) => {
    const subject = historicalRequestClass(item)?.subject_name || item.subjects_missed || "your class";
    const label = `${item.type === "late" ? "Late report" : "Excuse letter"} #${String(item.id).slice(0, 8)} for ${subject}`;
    const action = { approved: "approved", noted: "noted", invalid: "marked invalid" }[item.status];
    return action && item.date_reviewed
      ? [{ id: `${item.id}-reviewed`, requestId: item.id, message: `${label} ${action}.`, status: item.status, date: item.date_reviewed }]
      : [];
  }).filter((event) => Number.isFinite(Date.parse(event.date)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, limit);
}
