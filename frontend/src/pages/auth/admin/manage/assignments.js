export function activeTeachingAssignment(row) {
  if (!row) return null;
  if (Object.hasOwn(row, "active_teaching_assignment")) return row.active_teaching_assignment;
  if (!row.instructor && !row.instructor_id) return null;
  return { instructor_id: row.instructor_id || row.instructor?.id, instructor: row.instructor || null };
}

export function assignedInstructor(row, instructors = []) {
  const assignment = activeTeachingAssignment(row);
  if (!assignment) return null;
  const embedded = assignment.instructor || assignment.user || assignment.assigned_instructor;
  const id = assignment.instructor_id || embedded?.id || row?.instructor_id;
  return embedded || instructors.find(item => String(item.id) === String(id)) || (id ? { id, name: assignment.instructor_name } : null);
}

export function classLabel(row) {
  if (!row) return "Class unavailable";
  return [row.subject_name || "Subject unavailable", row.section && `Section ${row.section}`].filter(Boolean).join(" — ");
}

export function assignmentSelection(source = null) {
  const assigned = Boolean(activeTeachingAssignment(source));
  return {
    sourceClassId: source?.id || "",
    instructorId: "",
    programId: "",
    yearLevel: "",
    semester: "",
    targetClassId: source && !assigned ? String(source.id) : "",
  };
}

export function changeAssignmentSelection(selection, field, value) {
  const next = { ...selection, [field]: value };
  if (field === "programId") {
    next.yearLevel = "";
    next.semester = "";
  } else if (field === "yearLevel") {
    next.semester = "";
  }
  return next;
}
