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

function assignedInstructorId(row) {
  const assignment = activeTeachingAssignment(row);
  const embedded = assignment?.instructor || assignment?.user || assignment?.assigned_instructor;
  return assignment?.instructor_id || embedded?.id || row?.instructor_id || null;
}

function sameTerm(left, right) {
  return left?.semester === right?.semester && left?.school_year === right?.school_year;
}

export function assignmentCandidates(classes, source, action) {
  return classes.filter((item) => {
    const assignment = activeTeachingAssignment(item);
    if (action === "assign") return !assignment;
    if (!source || String(item.id) === String(source.id) || !sameTerm(source, item)) return false;
    if (action === "change_subject") return !assignment;
    if (action === "swap") return Boolean(assignment) && String(assignedInstructorId(item)) !== String(assignedInstructorId(source));
    return false;
  });
}

export function buildAssignmentPayload(action, source, selection, reason) {
  const payload = {
    action,
    expected_revision: Number(source?.assignment_revision || 0),
    reason: reason.trim(),
  };
  if (action === "assign" || action === "change_instructor") payload.instructor_id = selection.instructorId;
  if (action === "change_subject" || action === "swap") {
    payload.target_class_id = selection.targetClass.id;
    payload.target_expected_revision = Number(selection.targetClass.assignment_revision || 0);
  }
  return payload;
}

export function mergeAssignmentClasses(classes, changed = []) {
  const updates = new Map(changed.map(item => [String(item.id), item]));
  return classes.map(item => updates.has(String(item.id)) ? { ...item, ...updates.get(String(item.id)) } : item);
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
