import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getInstructorClassRecords } from "@/api/instructor";
import { ResourceState } from "@/components/dashboard/ResourceState";
import TablePageSkeleton from "@/components/loading/TablePageSkeleton";
import PageBreadcrumbs from "@/components/navigation/PageBreadcrumbs";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import InstructorPageLayout from "../InstructorPageLayout";
import CoursesTable from "./CoursesTable";
import CourseStudents from "./CourseStudents";
import SubjectFilter from "./SubjectFilter";
import { buildClassRecords } from "./recordData";

export default function InstructorClassRecords() {
  const { user } = useAuth();
  const { classId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const resource = useApiResource(getInstructorClassRecords, user?.id || "", { cacheKey: `instructor:class-records:${user?.id || "unknown"}` });
  const courses = useMemo(() => buildClassRecords(resource.data || [], [...(user?.programs || []), ...(user?.program ? [user.program] : [])]), [resource.data, user]);
  const course = courses.find(item => item.id === classId);
  const subject = params.get("subject") || "";
  const type = params.get("type") === "late" ? "late" : "absence";
  const filtered = subject ? courses.filter(item => item.id === subject) : courses;

  function changeSubject(value) {
    if (classId) navigate(value ? `/instructor/class-records/${encodeURIComponent(value)}?type=${type}` : "/instructor/class-records");
    else setParams(current => { if (value) current.set("subject", value); else current.delete("subject"); return current; });
  }

  return <InstructorPageLayout title="Class Records">
    <section aria-label="Class records" className="grid min-w-0 gap-5">
      {resource.loading ? <TablePageSkeleton layout={classId ? "course-detail" : "courses"} label="Loading class records..." /> : <>
      {classId && <PageBreadcrumbs items={[{ label: "Courses", to: "/instructor/class-records" }, { label: course?.subjectName || "Class Records" }]} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 break-words text-2xl font-bold text-slate-950">{classId ? course?.subjectName || "Class Records" : "Courses"}</h1>
        <SubjectFilter courses={courses} value={classId || subject} onChange={changeSubject} disabled={resource.loading || Boolean(resource.error) || !courses.length} />
      </div>
      <p className="text-xs leading-5 text-slate-500">Submitted reports only. Unavailable values are not supplied by the current API.</p>
      <ResourceState error={resource.error} onRetry={resource.reload}>
        {classId ? course ? <CourseStudents course={course} type={type} onTypeChange={value => setParams(current => { current.set("type", value); return current; })} /> : <p className="py-12 text-center text-sm text-slate-500">No request records found for this class.</p> : <CoursesTable courses={filtered} />}
      </ResourceState>
      </>}
    </section>
  </InstructorPageLayout>;
}
