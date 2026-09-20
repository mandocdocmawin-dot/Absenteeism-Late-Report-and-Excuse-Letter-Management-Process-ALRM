import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Search,
  UserCircle,
} from "lucide-react";
import { getAdminStudent } from "@/api/adminStudents";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AdminPageLayout from "./AdminPageLayout";

const statusOptions = [
  { label: "All Status", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Valid", value: "valid" },
  { label: "Invalid", value: "invalid" },
  { label: "Pending", value: "pending" },
];

function valueFrom(item, keys, fallback = "") {
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => current?.[part], item);
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return fallback;
}

function formatDate(value) {
  if (!value) return "Not recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function displayId(student) {
  return valueFrom(
    student,
    ["student_id", "studentId", "display_id", "displayId", "profile.student_id", "id"],
    "Unassigned",
  );
}

function programName(student) {
  return valueFrom(
    student,
    [
      "program_name",
      "programName",
      "program.program_name",
      "program.name",
      "profile.program.program_name",
      "profile.program.name",
    ],
    "Unassigned",
  );
}

function yearLevel(student) {
  return valueFrom(
    student,
    [
      "year_level",
      "yearLevel",
      "year_section",
      "yearSection",
      "section",
      "profile.year_level",
      "profile.yearLevel",
      "profile.section",
    ],
    "Unassigned",
  );
}

function studentName(student) {
  return valueFrom(student, ["name", "full_name", "fullName", "user.name"], "Unnamed Student");
}

function studentEmail(student) {
  return valueFrom(student, ["email", "user.email", "profile.email"], "Not recorded");
}

function studentContact(student) {
  return valueFrom(
    student,
    ["contact_number", "contactNumber", "phone", "mobile_number", "profile.contact_number"],
    "Not recorded",
  );
}

function listFrom(value) {
  return Array.isArray(value) ? value : [];
}

function studentRequests(student) {
  const directRequests = valueFrom(
    student,
    ["requests", "excuse_requests", "excuseRequests", "absence_late_requests"],
    null,
  );

  if (Array.isArray(directRequests)) return directRequests;

  return listFrom(student?.enrollments).flatMap((enrollment) => {
    const enrollmentRequests =
      enrollment?.requests ||
      enrollment?.excuse_requests ||
      enrollment?.excuseRequests ||
      enrollment?.absence_late_requests ||
      [];

    return listFrom(enrollmentRequests).map((request) => ({
      ...request,
      class: request.class || enrollment.class,
      class_name:
        request.class_name ||
        request.className ||
        valueFrom(enrollment, ["class.subject_name", "class.name"], ""),
    }));
  });
}

function attendanceSummary(student) {
  const directAttendance = valueFrom(
    student,
    ["attendance", "attendance_tracker", "attendanceTracker", "absence_summary"],
    null,
  );

  if (directAttendance) return directAttendance;

  const enrollment = listFrom(student?.enrollments).find(
    (item) => item?.attendance_tracker || item?.attendanceTracker || item?.attendance,
  );

  return enrollment?.attendance_tracker || enrollment?.attendanceTracker || enrollment?.attendance || null;
}

function requestClass(request) {
  return valueFrom(
    request,
    [
      "class_name",
      "className",
      "subject_name",
      "subjectName",
      "class.subject_name",
      "class.name",
      "subject.name",
    ],
    "Unassigned",
  );
}

function requestDate(request) {
  return valueFrom(
    request,
    [
      "date_absent_late",
      "dateAbsentLate",
      "start_date_of_absence",
      "startDateOfAbsence",
      "end_date_of_absence",
      "endDateOfAbsence",
      "late_date",
      "lateDate",
      "incident_date",
      "incidentDate",
      "date",
    ],
    "",
  );
}

function requestSubmittedDate(request) {
  return valueFrom(
    request,
    ["date_submitted", "dateSubmitted", "created_at", "createdAt"],
    requestDate(request),
  );
}

function requestReason(request) {
  return valueFrom(
    request,
    ["reason", "reason_of_absence", "reasonOfAbsence", "description"],
    "No reason stated",
  );
}

function requestStatus(request) {
  return valueFrom(
    request,
    ["status", "approval_status", "approvalStatus", "request_status", "requestStatus"],
    "",
  );
}

function normalizeStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "noted") return "valid";
  if (normalized === "accepted") return "approved";
  if (normalized === "rejected" || normalized === "declined") return "invalid";
  return normalized;
}

function statusLabel(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "valid") return "Valid";
  if (normalized === "approved") return "Approved";
  if (normalized === "invalid") return "Invalid";
  if (normalized === "pending") return "Pending";
  return status || "Unknown";
}

function statusClassName(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "approved") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (normalized === "valid") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (normalized === "invalid") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function StudentIdentityCard({ student }) {
  return (
    <div className="flex min-h-[116px] items-center gap-4 rounded-[5px] border border-slate-300 bg-white px-4 py-5 sm:px-5">
      <Avatar className="size-16 bg-slate-100">
        <AvatarFallback className="bg-slate-100 text-slate-500">
          <UserCircle className="size-14" strokeWidth={1.45} />
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0">
        <h2 className="truncate text-xl font-black text-[#203b82]">
          {studentName(student)}
        </h2>
        <p className="mt-1 text-xs font-bold text-[#203b82]">
          Program: {programName(student)}
        </p>
        <p className="mt-1 text-xs font-bold text-[#203b82]">
          Student ID: {displayId(student)}
        </p>
        <p className="mt-1 truncate text-xs font-bold text-[#203b82]">
          Email: {studentEmail(student)}
        </p>
        <p className="mt-1 text-xs font-bold text-[#203b82]">
          Contact: {studentContact(student)}
        </p>
      </div>
    </div>
  );
}

function AbsenceCountCard({ attendance }) {
  const threshold = Number(attendance?.threshold || attendance?.absence_threshold || 6);
  const count = Number(
    attendance?.converted_absences ??
      attendance?.convertedAbsences ??
      attendance?.absence_count ??
      attendance?.absenceCount ??
      attendance?.total_absences ??
      attendance?.totalAbsences ??
      0,
  );
  const percent = threshold > 0 ? Math.min(100, Math.round((count / threshold) * 100)) : 0;

  return (
    <div className="rounded-[5px] border border-slate-300 bg-slate-50 px-4 py-4">
      <p className="text-xs font-medium text-slate-950">Absence Count</p>
      <p className="mt-3 text-2xl font-black text-[#14285f]">
        {count}/{threshold}
      </p>
      <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
        <Progress
          value={percent}
          className="[&_[data-slot=progress-indicator]]:bg-[#203b82] [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:rounded-none [&_[data-slot=progress-track]]:bg-slate-300"
        />
        <span className="text-sm font-medium text-slate-950">{percent}%</span>
      </div>
      <div className="mt-1 border-t border-[#9aa9cf] pt-1 text-xs font-medium text-slate-950">
        Threshold: {threshold} Absences
      </div>
    </div>
  );
}

function RequestStatusBadge({ status }) {
  return (
    <span
      className={[
        "inline-flex min-w-[48px] justify-center rounded-[3px] border px-2 py-0.5 text-[11px] font-bold",
        statusClassName(status),
      ].join(" ")}
    >
      {statusLabel(status)}
    </span>
  );
}

function RequestFilters({ search, status, onSearchChange, onStatusChange }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-[210px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search Requests..."
          aria-label="Search requests"
          className="h-9 rounded-[5px] border-[#9aa9cf] pl-9 text-sm shadow-none"
        />
      </div>

      <div className="relative w-full sm:w-[126px]">
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          aria-label="Filter request status"
          className="h-9 w-full appearance-none rounded-[5px] border border-[#9aa9cf] bg-white px-3 pr-9 text-sm font-medium text-[#203b82] outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#203b82]" />
      </div>
    </div>
  );
}

function RequestsTable({ requests }) {
  if (requests.length === 0) {
    return (
      <Empty className="min-h-[180px] rounded-[5px] border border-slate-200">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Search className="size-4" />
          </EmptyMedia>
          <EmptyTitle>No requests found</EmptyTitle>
          <EmptyDescription>
            Try a different request search or status filter.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-200">
      <Table className="min-w-[780px]">
        <TableHeader className="bg-slate-100">
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-4 py-3 text-xs font-black text-slate-950">
              Date
            </TableHead>
            <TableHead className="px-4 py-3 text-xs font-black text-slate-950">
              Class
            </TableHead>
            <TableHead className="px-4 py-3 text-xs font-black text-slate-950">
              Reason
            </TableHead>
            <TableHead className="px-4 py-3 text-xs font-black text-slate-950">
              Date Absent/late
            </TableHead>
            <TableHead className="px-4 py-3 text-xs font-black text-slate-950">
              Status
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id} className="hover:bg-transparent">
              <TableCell className="px-4 py-4 text-xs font-bold text-slate-950">
                {formatDate(requestSubmittedDate(request))}
              </TableCell>
              <TableCell className="px-4 py-4 text-xs font-bold text-slate-950">
                {requestClass(request)}
              </TableCell>
              <TableCell className="max-w-[260px] truncate px-4 py-4 text-xs font-medium text-slate-950">
                {requestReason(request)}
              </TableCell>
              <TableCell className="px-4 py-4 text-xs font-medium text-slate-950">
                {formatDate(requestDate(request))}
              </TableCell>
              <TableCell className="px-4 py-4 text-xs font-medium text-slate-950">
                <RequestStatusBadge status={requestStatus(request)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StudentProfile() {
  const navigate = useNavigate();
  const { studentId } = useParams();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState("all");

  useEffect(() => {
    let alive = true;

    async function loadStudent() {
      setLoading(true);
      setError("");

      try {
        const data = await getAdminStudent(studentId);
        if (alive) setStudent(data);
      } catch (loadError) {
        if (alive) {
          setStudent(null);
          setError(loadError?.message || "Unable to load this student profile.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadStudent();

    return () => {
      alive = false;
    };
  }, [studentId]);

  const filteredRequests = useMemo(() => {
    const requests = studentRequests(student);
    const search = requestSearch.trim().toLowerCase();

    return requests.filter((request) => {
      const normalized = normalizeStatus(requestStatus(request));
      const matchesStatus =
        requestStatus === "all" || normalized === requestStatus;
      const haystack = [
        requestClass(request),
        requestReason(request),
        statusLabel(requestStatus(request)),
        request.type,
        request.request_type,
        requestDate(request),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!search || haystack.includes(search));
    });
  }, [requestSearch, requestStatus, student]);

  return (
    <AdminPageLayout>
      <div className="mx-auto grid w-full max-w-[1040px] gap-6">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/students")}
          className="h-auto w-fit rounded-[5px] px-0 py-0 text-sm font-black text-[#203b82] hover:bg-transparent hover:text-[#14285f]"
        >
          <ArrowLeft className="size-4" />
          Back to Students
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-black tracking-normal text-slate-950">
            Student Profile
          </h1>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-between rounded-[5px] border-[#9aa9cf] px-3 text-base font-medium text-[#203b82] sm:w-[124px]"
          >
            Actions
            <ChevronDown className="size-4" />
          </Button>
        </div>

        {loading && (
          <div className="flex min-h-[320px] items-center justify-center rounded-[5px] border border-slate-200">
            <Spinner className="mr-2" />
            <span className="text-sm font-medium text-slate-600">
              Loading student profile...
            </span>
          </div>
        )}

        {!loading && error && (
          <Alert variant="destructive" className="rounded-[5px]">
            <AlertCircle className="size-4" />
            <AlertTitle>Unable to load profile</AlertTitle>
            <AlertDescription>
              {error}
              {error.includes("404") &&
                " Confirm that GET /api/admin/students/{student} is available on the backend."}
            </AlertDescription>
          </Alert>
        )}

        {!loading && !error && student && (
          <>
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
              <StudentIdentityCard student={student} />
              <AbsenceCountCard attendance={attendanceSummary(student)} />
            </section>

            <div className="text-xs font-bold text-slate-600">
              Year/Section: {yearLevel(student)}
            </div>

            <RequestFilters
              search={requestSearch}
              status={requestStatus}
              onSearchChange={setRequestSearch}
              onStatusChange={setRequestStatus}
            />

            <RequestsTable requests={filteredRequests} />

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-[5px] border-[#9aa9cf] px-4 text-sm font-medium text-slate-500"
              >
                Details
              </Button>
            </div>
          </>
        )}
      </div>
    </AdminPageLayout>
  );
}

export default StudentProfile;
