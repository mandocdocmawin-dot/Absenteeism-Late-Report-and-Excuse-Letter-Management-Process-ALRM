import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ChevronDown, Search, UserRound } from "lucide-react";
import { getAdminPrograms } from "@/api/adminUsers";
import { getAdminStudents } from "@/api/adminStudents";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
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

const yearOptions = [
  { label: "1st Year", value: "1st Year" },
  { label: "2nd Year", value: "2nd Year" },
  { label: "3rd Year", value: "3rd Year" },
  { label: "4th Year", value: "4th Year" },
];

function valueFrom(item, keys, fallback = "") {
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => current?.[part], item);
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return fallback;
}

function studentDisplayId(student) {
  return valueFrom(
    student,
    ["student_id", "studentId", "display_id", "displayId", "id"],
    "Unassigned",
  );
}

function studentRecordId(student) {
  return valueFrom(student, ["id", "user_id", "userId", "student_id", "studentId"], "");
}

function studentProgram(student) {
  return valueFrom(
    student,
    ["program_name", "programName", "program.program_name", "program.name"],
    "Unassigned",
  );
}

function programRecordId(program) {
  return valueFrom(program, ["id", "program_id", "programId"], "");
}

function programLabel(program) {
  return valueFrom(program, ["program_name", "programName", "name"], "Unnamed Program");
}

function studentYear(student) {
  return valueFrom(
    student,
    ["year_level", "yearLevel", "year_section", "yearSection"],
    "Unassigned",
  );
}

function SelectFilter({ label, value, onChange, children }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        aria-label={label}
        className="h-10 w-full min-w-0 appearance-none rounded-[5px] border border-[#9aa9cf] bg-white px-4 pr-10 text-sm font-medium text-slate-900 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-w-[204px]"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-900" />
    </div>
  );
}

function StudentFilters({ filters, loadingPrograms, onChange, programs }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(220px,236px)_minmax(180px,204px)_minmax(160px,204px)]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={filters.search}
          onChange={(event) => onChange("search", event.target.value)}
          placeholder="Search Name..."
          aria-label="Search student name"
          className="h-10 rounded-[5px] border-[#9aa9cf] pl-9 text-sm shadow-none"
        />
      </div>

      <SelectFilter
        label="Filter course"
        value={filters.programId}
        onChange={(event) => onChange("programId", event.target.value)}
      >
        <option value="">
          {loadingPrograms ? "Loading Courses..." : "Filter Course"}
        </option>
        {programs.map((program, index) => (
          <option key={programRecordId(program) || index} value={programRecordId(program)}>
            {programLabel(program)}
          </option>
        ))}
      </SelectFilter>

      <SelectFilter
        label="Filter year"
        value={filters.yearLevel}
        onChange={(event) => onChange("yearLevel", event.target.value)}
      >
        <option value="">Filter Year</option>
        {yearOptions.map((year) => (
          <option key={year.value} value={year.value}>
            {year.label}
          </option>
        ))}
      </SelectFilter>
    </div>
  );
}

function StudentsTable({ loading, onOpenStudent, students }) {
  if (loading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-[5px] border border-slate-200">
        <Spinner className="mr-2" />
        <span className="text-sm font-medium text-slate-600">
          Loading students...
        </span>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <Empty className="min-h-[260px] rounded-[5px] border border-slate-200">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserRound className="size-4" />
          </EmptyMedia>
          <EmptyTitle>No students found</EmptyTitle>
          <EmptyDescription>
            Try a different search term, program, or year filter.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow className="border-[#b9c2dd] hover:bg-transparent">
            <TableHead className="w-[26%] px-0 py-3 text-sm font-black text-[#203b82]">
              Name
            </TableHead>
            <TableHead className="w-[26%] px-0 py-3 text-sm font-black text-[#203b82]">
              ID
            </TableHead>
            <TableHead className="w-[26%] px-0 py-3 text-sm font-black text-[#203b82]">
              Program
            </TableHead>
            <TableHead className="w-[22%] px-0 py-3 text-sm font-black text-[#203b82]">
              Year/Section
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student, index) => {
            const recordId = studentRecordId(student);

            return (
              <TableRow
                key={recordId || index}
                onClick={() => recordId && onOpenStudent(recordId)}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if (recordId) onOpenStudent(recordId);
                  }
                }}
                className={[
                  "border-[#c5cde0] hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none",
                  recordId ? "cursor-pointer" : "cursor-default",
                ].join(" ")}
              >
                <TableCell className="px-0 py-5 text-sm font-semibold text-slate-950">
                  {index + 1}. {student.name || "Unnamed Student"}
                </TableCell>
                <TableCell className="px-0 py-5 text-sm font-medium text-slate-950">
                  {studentDisplayId(student)}
                </TableCell>
                <TableCell className="px-0 py-5 text-sm font-medium text-slate-950">
                  {studentProgram(student)}
                </TableCell>
                <TableCell className="px-0 py-5 text-sm font-medium text-slate-950">
                  {studentYear(student)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function Students() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    search: "",
    programId: "",
    yearLevel: "",
  });
  const [programs, setPrograms] = useState([]);
  const [students, setStudents] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadPrograms() {
      setLoadingPrograms(true);

      try {
        const data = await getAdminPrograms();
        if (alive) setPrograms(data);
      } catch (loadError) {
        if (alive) setError(loadError?.message || "Unable to load programs.");
      } finally {
        if (alive) setLoadingPrograms(false);
      }
    }

    loadPrograms();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadStudents() {
      setLoadingStudents(true);
      setError("");

      try {
        const data = await getAdminStudents(filters);
        if (alive) setStudents(data);
      } catch (loadError) {
        if (alive) {
          setStudents([]);
          setError(
            loadError?.message ||
              "Unable to load students from the admin student endpoint.",
          );
        }
      } finally {
        if (alive) setLoadingStudents(false);
      }
    }

    loadStudents();

    return () => {
      alive = false;
    };
  }, [filters]);

  const activeProgramName = useMemo(() => {
    if (!filters.programId) return "";

    const program = programs.find(
      (item) => String(programRecordId(item)) === String(filters.programId),
    );
    return program ? programLabel(program) : "";
  }, [filters.programId, programs]);

  function handleFilterChange(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  return (
    <AdminPageLayout>
      <div className="mx-auto grid w-full max-w-[980px] gap-6">
        <section>
          <h1 className="text-2xl font-black uppercase tracking-normal text-slate-950">
            Students
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-700">
            Manage and view all students in the system
          </p>
        </section>

        <StudentFilters
          filters={filters}
          loadingPrograms={loadingPrograms}
          onChange={handleFilterChange}
          programs={programs}
        />

        {error && (
          <Alert variant="destructive" className="rounded-[5px]">
            <AlertCircle className="size-4" />
            <AlertTitle>Unable to load student data</AlertTitle>
            <AlertDescription>
              {error}
              {error.includes("404") &&
                " Confirm that GET /api/admin/students is available on the backend."}
            </AlertDescription>
          </Alert>
        )}

        {(activeProgramName || filters.yearLevel || filters.search) && (
          <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
            {filters.search && <span>Search: {filters.search}</span>}
            {activeProgramName && <span>Program: {activeProgramName}</span>}
            {filters.yearLevel && <span>Year: {filters.yearLevel}</span>}
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setFilters({ search: "", programId: "", yearLevel: "" })
              }
              className="h-auto rounded-[5px] px-2 py-0 text-xs font-black text-[#203b82]"
            >
              Clear filters
            </Button>
          </div>
        )}

        <StudentsTable
          loading={loadingStudents}
          onOpenStudent={(studentId) => navigate(`/students/${studentId}`)}
          students={students}
        />
      </div>
    </AdminPageLayout>
  );
}

export default Students;
