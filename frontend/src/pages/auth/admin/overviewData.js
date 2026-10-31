import { isGeneralEducationProgram } from "../../../lib/programs.js";
import { historicalInstructor, historicalInstructorName, historicalRequestClass } from "../../../lib/requestHistory.js";

function eventDate(value) { return value && Number.isFinite(Date.parse(value)) ? value : null; }
function newest(rows) { return rows.filter(row => eventDate(row.date)).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)); }
const auditActions = { submitted_request: "Submitted", updated_request: "Updated", cancelled_request: "Cancelled", followed_up_request: "Followed up", decided_request_approved: "Approved", decided_request_noted: "Noted", decided_request_invalid: "Denied", resolved_followup_flag: "Resolved" };
function requestInfo(request) {
  const course = historicalRequestClass(request);
  const student = request.enrollment?.student;
  return { student: student?.name || "Unavailable", studentId: student?.school_id_number || "", email: student?.email || "", subject: course?.subject_name || request.subjects_missed || "Unavailable", classId: course?.id || "", type: request.type === "absence" ? "Absent" : request.type === "late" ? "Late" : "Unavailable", instructor: historicalInstructorName(request) };
}
export function requestActivity(requests = []) {
  return newest(requests.flatMap(request => {
    const info = requestInfo(request);
    const events = [{ ...info, id: `${request.id}-submitted`, date: request.date_submitted || request.created_at, action: "Submitted" }];
    const action = { approved: "Approved", noted: "Noted", invalid: "Denied" }[request.status];
    if (action && eventDate(request.date_reviewed)) events.push({ ...info, id: `${request.id}-reviewed`, date: request.date_reviewed, action });
    if (eventDate(request.followupFlag?.flagged_date || request.followup_flag?.flagged_date)) {
      const flag = request.followupFlag || request.followup_flag;
      events.push({ ...info, id: `${request.id}-flagged`, date: flag.flagged_date, action: "Flagged" });
    }
    return events;
  }));
}
export function flagActivity(flags = []) {
  return newest(flags.map(flag => {
    const request = flag.request || {};
    const info = requestInfo(request);
    const instructor = historicalInstructorName(request);
    return { ...info, id: flag.id, date: flag.flagged_date || flag.created_at, action: "Flagged", instructor, flaggedBy: instructor };
  }));
}
export function auditActivity(logs = [], { classes = [], requests = [], instructors = [] } = {}) {
  const requestsById = new Map(requests.map(item => [String(item.id), item]));
  const classesById = new Map(classes.map(item => [String(item.id), item]));
  return newest(logs.map(log => {
    const request = log.request || {};
    const course = historicalRequestClass(request) || {};
    const matchingRequest = requestsById.get(String(request.id));
    const matchingClass = classesById.get(String(course.id));
    const instructor = historicalInstructorName(request, "", instructors)
      || historicalInstructorName(matchingRequest, "", instructors)
      || historicalInstructor(matchingClass, instructors)?.name
      || "—";
    return { id: log.id, requestId: request.id || "", date: log.timestamp, student: request.student?.name || request.enrollment?.student?.name || "Unavailable", studentId: "", email: "", subject: course.subject_name || "Unavailable", classId: course.id || "", type: request.type === "absence" ? "Absent" : request.type === "late" ? "Late" : "Unavailable", action: auditActions[log.action] || log.description || "Unavailable", instructor, actor: log.actor?.name || "Unavailable", description: log.description || auditActions[log.action] || "Activity recorded" };
  }));
}
export function filterActivity(rows, { search = "", action = "", subject = "", date = "" } = {}) {
  const query = search.trim().toLowerCase();
  return rows.filter(row => (!query || [row.student, row.studentId, row.email, row.subject, row.instructor, row.type, row.action].some(value => String(value || "").toLowerCase().includes(query))) && (!action || row.action === action) && (!subject || row.classId === subject) && (!date || (() => {
    const time = new Date(row.date);
    const day = `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, "0")}-${String(time.getDate()).padStart(2, "0")}`;
    return day === date;
  })()));
}
export function programOverviewRows(dashboard, classes = []) {
  return (dashboard?.programs_summary || []).filter(program => !isGeneralEducationProgram(program)).map(program => {
    const programClasses = classes.filter(course => course.program_id === program.id);
    return {
      id: program.id, name: program.program_name, students: program.student_count ?? null,
      classes: program.classes_count ?? programClasses.length,
      instructors: new Set(programClasses.map(course => course.active_teaching_assignment?.instructor_id || course.active_teaching_assignment?.instructor?.id || course.instructor_id).filter(Boolean)).size,
    };
  });
}
