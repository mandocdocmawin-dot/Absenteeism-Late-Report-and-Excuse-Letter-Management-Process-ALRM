import { Link } from "react-router-dom";
import ClassRecordsTable from "./ClassRecordsTable";

const columns = [
  { label: "Name", width: "42%" }, { label: "Program", width: "25%" },
  { label: "Year", width: "13%", center: true },
  { label: "Actions", width: "20%", center: true },
];

export default function CoursesTable({ courses }) {
  return <ClassRecordsTable columns={columns} caption="Courses with submitted student reports" empty={!courses.length && "No classes with submitted reports match this filter."}>
    {courses.map(course => <tr key={course.id} className="hover:bg-slate-50">
      <td className="break-words px-3 py-3">{course.subjectName}</td>
      <td className="break-words px-3 py-3">{course.program}</td>
      <td className="break-words px-3 py-3 text-center">{course.year}</td>
      <td className="px-3 py-3 text-center"><Link to={`/instructor/class-records/${encodeURIComponent(course.id)}`} aria-label={`View records for ${course.subjectName}, ${course.program}${course.section ? `, Section ${course.section}` : ""}`} className="inline-flex min-h-8 w-24 items-center justify-center rounded-[4px] bg-[#203B82] px-3 text-xs font-semibold text-white hover:bg-[#172B63] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">View</Link></td>
    </tr>)}
  </ClassRecordsTable>;
}
