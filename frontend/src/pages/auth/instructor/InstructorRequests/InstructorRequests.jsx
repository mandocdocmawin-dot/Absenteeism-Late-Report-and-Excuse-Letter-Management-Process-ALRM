import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ResourceState } from "@/components/dashboard/ResourceState";
import TablePageSkeleton from "@/components/loading/TablePageSkeleton";
import PageBreadcrumbs from "@/components/navigation/PageBreadcrumbs";
import RecordTypeTabs from "@/components/records/RecordTypeTabs";
import { getProfileSetupPrograms } from "@/api/profileSetup";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import InstructorPageLayout from "../InstructorPageLayout";
import SubjectFilter from "../InstructorClassRecords/SubjectFilter";
import { paginateRecords } from "../../student/records/pagination";
import RequestFilters from "./RequestFilters";
import RequestCoursesTable from "./RequestCoursesTable";
import RequestsTable from "./RequestsTable";
import RequestPagination from "./RequestPagination";
import RequestDetailDialog from "./RequestDetailDialog";
import { filterRequests, requestCourse, requestCourses, requestStatuses, updateRequestParams } from "./requestData";
import { loadRequests } from "./requestApi";
import { exportRequests } from "./requestCsv";

export default function InstructorRequests() {
  const { user } = useAuth();
  const { classId } = useParams();
  const resource = useApiResource(loadRequests, user?.id || "", { cacheKey: `instructor:requests:${user?.id || "unknown"}` });
  const programResource = useApiResource(getProfileSetupPrograms, user?.id || "", { cacheKey: "shared:profile-programs" });
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exportError, setExportError] = useState("");
  const records = resource.data || [];
  const selected = records.find(record => String(record.id) === params.get("request") && (!classId || String(requestCourse(record)?.id) === classId));
  const type = ["absence", "late"].includes(params.get("type")) ? params.get("type") : selected?.type === "late" ? "late" : "absence";
  const subject = params.get("subject") || "";
  const status = requestStatuses.includes(params.get("status")) ? params.get("status") : "";
  const programs = [...(programResource.data || []), ...(user?.programs || []), ...(user?.program ? [user.program] : [])];
  const allCourses = requestCourses(records, programs);
  const listRecords = records.filter(record => (!["absence", "late"].includes(params.get("type")) || record.type === type) && (!status || record.status === status));
  const courses = requestCourses(listRecords, programs);
  const activeClassId = classId || (requestCourse(selected)?.id ? String(requestCourse(selected).id) : "");
  const course = allCourses.find(item => item.id === activeClassId);
  const visibleCourses = subject ? courses.filter(item => item.id === subject) : courses;
  const filtered = filterRequests(records, { type, subject: activeClassId, status, search });
  const pagination = paginateRecords(filtered, page);
  const detailParams = new URLSearchParams();
  if (["absence", "late"].includes(params.get("type"))) detailParams.set("type", type);
  if (status) detailParams.set("status", status);
  const detailSearch = detailParams.toString() ? `?${detailParams}` : "";
  function change(changes) { setPage(1); setParams(current => updateRequestParams(current, changes)); }
  function download() { setExportError(""); try { exportRequests(filtered); } catch { setExportError("The CSV could not be exported. Please try again."); } }
  return <InstructorPageLayout title="Request">
    <section aria-label="Class requests" className="grid min-w-0 gap-5">
      {resource.loading || programResource.loading ? <TablePageSkeleton layout={classId ? "requests" : "courses"} label="Loading class requests..." /> : <>
      {activeClassId && <PageBreadcrumbs items={[{ label: "Courses", to: "/instructor/class-requests" }, { label: course ? `${course.subjectName} - ${course.program}` : "Class Requests" }]} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 break-words text-2xl font-bold text-slate-950">{activeClassId ? course?.subjectName || "Class Requests" : "Courses"}</h1>
        {!activeClassId && <SubjectFilter courses={allCourses} value={subject} onChange={value => change({ subject: value })} disabled={Boolean(resource.error) || !allCourses.length} />}
      </div>
      {activeClassId ? course && <p className="text-sm text-slate-600">{course.program} · Year {course.year}{course.section ? ` · Section ${course.section}` : ""}</p> : <p className="text-xs leading-5 text-slate-500">Courses with submitted requests.</p>}
      {programResource.error && <p role="alert" className="text-sm text-slate-600">Program names could not be loaded. <button type="button" onClick={programResource.reload} className="text-[#203B82] underline">Retry</button></p>}
      <ResourceState error={resource.error} onRetry={resource.reload}>
        {activeClassId ? course ? <RecordTypeTabs value={type} onValueChange={value => change({ type: value })}>
          <div className="grid min-w-0 gap-5">
            {exportError && <p role="alert" className="text-sm text-red-700">{exportError}</p>}
            <RequestFilters search={search} status={status} onSearch={value => { setSearch(value); setPage(1); }} onChange={change} onExport={download} exportDisabled={!filtered.length} showSubject={false} />
            <RequestsTable records={pagination.pageRecords} caption={`Requests for ${course.subjectName}, ${course.program}`} onReview={record => change({ request: String(record.id), type: record.type })} />
            <RequestPagination pagination={pagination} total={filtered.length} onPage={setPage} />
          </div>
        </RecordTypeTabs> : <p className="py-12 text-center text-sm text-slate-500">No request records found for this class.</p> : <RequestCoursesTable courses={visibleCourses} search={detailSearch} />}
      </ResourceState>
      {params.get("request") && !selected && !resource.loading && !resource.error && <p role="alert" className="text-sm text-slate-500">This request is unavailable. <button type="button" className="underline" onClick={() => change({ request: "" })}>Dismiss</button></p>}
      </>}
    </section>
    {selected && <RequestDetailDialog key={selected.id} request={selected} onClose={() => setParams(current => updateRequestParams(current, { request: "" }))} onReload={resource.reload} />}
  </InstructorPageLayout>;
}
