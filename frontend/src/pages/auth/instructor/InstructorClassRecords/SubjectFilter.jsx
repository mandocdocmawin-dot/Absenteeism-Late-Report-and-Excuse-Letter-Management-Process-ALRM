export default function SubjectFilter({ courses, value, onChange, disabled }) {
  return <select aria-label="Filter subject" value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className="h-9 w-48 max-w-full rounded-[5px] border border-[#A9B9D9] bg-white pl-3 text-xs text-slate-900 outline-none focus:border-[#203B82] focus:ring-2 focus:ring-blue-100 disabled:opacity-50">
    <option value="">Filter Subject</option>
    {courses.map(course => <option key={course.id} value={course.id}>{course.subjectName} - {course.program}{course.year !== "Unavailable" ? ` Year ${course.year}` : ""}{course.section ? ` Section ${course.section}` : ""}</option>)}
  </select>;
}
