export const ATTENDANCE_POLICY = { semesterWeeks: 16, absenceLimitRate: 0.2, latesPerHour: 3 };

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;

function usedHours(student) {
  return round(Number(student.invalidAbsenceHours || 0) + Math.floor(Number(student.invalidLates || 0) / ATTENDANCE_POLICY.latesPerHour));
}

function unitsPerMeeting(course) {
  return Number(course.weekly_hours) / Math.max(1, Number(course.meetings_per_week));
}

function date(value) {
  const key = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const parsed = new Date(`${key}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== key ? null : parsed;
}

export function absenceHours(course, request) {
  const start = date(request.start_date_of_absence);
  if (!start || !Array.isArray(course.schedule) || !course.schedule.length) return unitsPerMeeting(course);
  const minutesByDay = {};
  for (const slot of course.schedule) {
    if (!slot || !slot.day || !timePattern.test(slot.start || "") || !timePattern.test(slot.end || "")) return unitsPerMeeting(course);
    const [startHour, startMinute] = slot.start.split(":").map(Number);
    const [endHour, endMinute] = slot.end.split(":").map(Number);
    minutesByDay[slot.day] = (minutesByDay[slot.day] || 0) + Math.max(0, (endHour * 60 + endMinute) - (startHour * 60 + startMinute));
  }
  const end = request.end_date_of_absence ? date(request.end_date_of_absence) : start;
  if (!end) return unitsPerMeeting(course);
  const days = Math.floor((end - start) / 86400000) + 1;
  if (days <= 0) return 0;
  let minutes = Math.floor(days / 7) * Object.values(minutesByDay).reduce((sum, value) => sum + value, 0);
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let offset = 0; offset < days % 7; offset += 1) minutes += minutesByDay[names[(start.getUTCDay() + offset) % 7]] || 0;
  return round(minutes / 60);
}

export function attendancePercentage(course, student) {
  if (course.weekly_hours == null || course.meetings_per_week == null || course.weekly_hours === "" || course.meetings_per_week === "") return null;
  const weeklyHours = Number(course.weekly_hours);
  const meetings = Number(course.meetings_per_week);
  if (!Number.isFinite(weeklyHours) || weeklyHours <= 0 || !Number.isFinite(meetings) || meetings <= 0) return null;
  return round(usedHours(student) / (weeklyHours * ATTENDANCE_POLICY.semesterWeeks) * 100);
}

export function attendanceAlert(course, student) {
  const percentage = attendancePercentage(course, student);
  if (percentage == null) return null;
  const weeklyHours = Number(course.weekly_hours);
  const used = usedHours(student);
  const dropLimit = weeklyHours === 3
    ? Math.ceil(weeklyHours * ATTENDANCE_POLICY.semesterWeeks * ATTENDANCE_POLICY.absenceLimitRate)
    : round(weeklyHours * ATTENDANCE_POLICY.semesterWeeks * ATTENDANCE_POLICY.absenceLimitRate);
  const level = used >= dropLimit ? "drop-limit" : used >= weeklyHours * 2 ? "critical" : used >= weeklyHours ? "preventive" : "safe";
  const labels = { safe: "Safe", preventive: "Preventive", critical: "Critical", "drop-limit": "Drop limit" };
  return { used, percentage, level, label: labels[level] };
}
