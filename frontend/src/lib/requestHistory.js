export function historicalRequestClass(request) {
  const snapshot = request?.class_snapshot;
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) return snapshot.class || snapshot;
  return request?.enrollment?.class || request?.class || null;
}

export function historicalInstructor(course, instructors = []) {
  if (!course) return null;
  const assignment = course.active_teaching_assignment || course.teaching_assignment;
  const instructor = course.instructor || course.assigned_instructor || assignment?.instructor;
  if (typeof instructor === "string") return { name: instructor };
  if (instructor?.name) return instructor;
  const instructorId = instructor?.id || assignment?.instructor_id || course.instructor_id;
  return instructors.find(item => String(item.id) === String(instructorId))
    || (course.instructor_name || assignment?.instructor_name ? { id: instructorId, name: course.instructor_name || assignment.instructor_name } : null);
}

export function historicalInstructorName(request, fallback = "Unavailable", instructors = []) {
  return historicalInstructor(historicalRequestClass(request), instructors)?.name || fallback;
}
