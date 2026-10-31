import { programShortName } from "../../../../lib/programs.js";

function courseRecord(source, programs) {
  const program = source.program || programs.find(item => item.id === source.program_id);
  const year = String(source.year_level ?? "").trim();
  return {
    id: source.id,
    subjectName: source.subject_name || "Subject unavailable",
    program: program?.program_code || program?.code || programShortName(program?.program_name) || "Unavailable",
    year: year.match(/^([1-4])(?:st|nd|rd|th)?(?:\s+year)?$/i)?.[1] || year || "Unavailable",
    section: source.section || "",
    studentCount: Number.isInteger(source.enrollments_count) && source.enrollments_count >= 0 ? source.enrollments_count : null,
    students: new Map(),
  };
}

export function buildClassRecords(requests = [], programs = []) {
  const classes = new Map();
  const seen = new Set();
  for (const request of requests) {
    const enrollment = request?.enrollment;
    const source = enrollment?.class;
    if (!request?.id || seen.has(request.id) || !source?.id || request.status === "cancelled" || !["absence", "late"].includes(request.type)) continue;
    seen.add(request.id);
    if (!classes.has(source.id)) classes.set(source.id, courseRecord(source, programs));
    const course = classes.get(source.id);
    const studentId = enrollment.student?.id || enrollment.student_id;
    if (!studentId) continue;
    if (!course.students.has(studentId)) {
      course.students.set(studentId, { id: studentId, name: enrollment.student?.name || "Name unavailable", absences: 0, lates: 0 });
    }
    const student = course.students.get(studentId);
    student[request.type === "absence" ? "absences" : "lates"] += 1;
  }
  return [...classes.values()].map(course => ({ ...course, students: [...course.students.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)) }))
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName) || a.program.localeCompare(b.program) || a.section.localeCompare(b.section) || a.id.localeCompare(b.id));
}

export function studentsForType(course, type) {
  if (!["absence", "late"].includes(type)) return [];
  return course.students.filter(student => student[type === "absence" ? "absences" : "lates"] > 0);
}
