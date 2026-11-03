import { useCallback, useEffect, useRef, useState } from "react";
import { GraduationCap, Search, UserRoundArrowLeft } from "lucide-react";
import {
  getAdminAssignmentCandidates,
  getAdminClassesPage,
  getAdminPrograms,
  getApprovedInstructors,
} from "@/api/adminAssignments";
import {
  getResourceCacheEntry,
  invalidateResourceCache,
  requestCachedResource,
  updateResourceCache,
} from "@/api/resourceCache";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import ResourceRefresh from "@/components/common/ResourceRefresh";
import FilterMenu, { RadioFilterGroup } from "@/components/common/FilterMenu";
import LoadingSkeleton from "@/components/loading/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSelectablePrograms } from "@/lib/programs";
import RequestPagination from "../instructor/InstructorRequests/RequestPagination";
import AssignmentDialog from "./manage/AssignmentDialog";
import RemoveAssignmentDialog from "./manage/RemoveAssignmentDialog";
import {
  activeTeachingAssignment,
  assignedInstructor,
  mergeAssignmentClasses,
} from "./manage/assignments.js";
import { usePageViewState } from "@/hooks/usePageViewState";

export default function AdminManage() {
  const candidateCacheKey = "admin:assignment-candidates";
  const [view, setView] = usePageViewState("admin:assignments:view", {
    search: "",
    programId: "",
    page: 1,
  });
  const { search, programId, page } = view;
  const cacheKey = `admin:assignments:${page}:${search.trim()}:${programId}`;
  const cached = getResourceCacheEntry(cacheKey);
  const cachedPrograms = getResourceCacheEntry("admin:assignment-programs");
  const cachedInstructors = getResourceCacheEntry("admin:assignment-instructors");
  const [classData, setClassData] = useState(cached?.data || null);
  const [classLoading, setClassLoading] = useState(!cached);
  const [programs, setPrograms] = useState(cachedPrograms?.data || []);
  const [instructors, setInstructors] = useState(cachedInstructors?.data || []);
  const [lookupError, setLookupError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(cached?.updatedAt || null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const mounted = useRef(false);
  const classRequestId = useRef(0);
  const lookupRequestId = useRef(0);

  const loadClasses = useCallback(
    (force = false) => {
      const requestId = ++classRequestId.current;
      return (
      requestCachedResource(
        cacheKey,
        async (signal) => {
          const classes = await getAdminClassesPage({
            signal,
            page,
            perPage: 25,
            filters: { search, programId },
          });
          return { classes: classes.data, classesMeta: classes.meta };
        },
        { force },
      )
        .then((next) => {
          if (mounted.current && requestId === classRequestId.current) {
            setClassData(next);
            setUpdatedAt(
              getResourceCacheEntry(cacheKey)?.updatedAt || Date.now(),
            );
          }
        })
        .catch((failure) => {
          if (mounted.current && requestId === classRequestId.current) {
            setError(failure.message || "Assignments could not be loaded.");
          }
        })
        .finally(() => {
          if (mounted.current && requestId === classRequestId.current) {
            setClassLoading(false);
          }
        })
      );
    },
    [cacheKey, page, search, programId],
  );

  const loadPrograms = useCallback((force = false, requestId = lookupRequestId.current) =>
    requestCachedResource(
      "admin:assignment-programs",
      (signal) => getAdminPrograms({ signal }),
      { force },
    )
      .then((next) => {
        if (mounted.current && requestId === lookupRequestId.current) setPrograms(next);
      })
      .catch((failure) => {
        if (mounted.current && requestId === lookupRequestId.current) {
          setLookupError(failure.message || "Program options could not be loaded.");
        }
      }), []);

  const loadInstructors = useCallback((force = false, requestId = lookupRequestId.current) =>
    requestCachedResource(
      "admin:assignment-instructors",
      (signal) => getApprovedInstructors({ signal }),
      { force },
    )
      .then((next) => {
        if (mounted.current && requestId === lookupRequestId.current) setInstructors(next);
      })
      .catch((failure) => {
        if (mounted.current && requestId === lookupRequestId.current) {
          setLookupError(failure.message || "Instructor options could not be loaded.");
        }
      }), []);

  const loadLookups = useCallback((force = false) => {
    const requestId = ++lookupRequestId.current;
    setLookupError("");
    return Promise.allSettled([
      loadPrograms(force, requestId),
      loadInstructors(force, requestId),
    ]);
  }, [loadPrograms, loadInstructors]);

  useEffect(() => {
    const requests = classRequestId;
    mounted.current = true;
    const timer = window.setTimeout(() => {
      setClassLoading(!getResourceCacheEntry(cacheKey));
      setError("");
      void loadClasses();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      requests.current++;
      mounted.current = false;
    };
  }, [cacheKey, loadClasses]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadLookups(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLookups]);

  const data = classData ? { ...classData, programs, instructors } : null;
  const selectablePrograms = getSelectablePrograms(programs);
  const assignableClasses = classData?.classes || [];
  const rows = assignableClasses.map((row) => {
    const instructor = assignedInstructor(row, instructors);
    return {
      ...row,
      displayInstructor: instructor?.name || "Unassigned",
      displayProgram:
        row.program?.program_name ||
        programs.find(
          (program) => String(program.id) === String(row.program_id),
        )?.program_name ||
        "Program unavailable",
    };
  });
  const classesMeta = classData?.classesMeta || {};
  const pagination = {
    currentPage: Number(classesMeta.page || page),
    totalPages: Math.max(1, Number(classesMeta.last_page || 1)),
    firstRecord: Math.max(
      0,
      (Number(classesMeta.page || page) - 1) *
        Number(classesMeta.per_page || 25),
    ),
    pageRecords: rows,
    pageButtons: Array.from(
      { length: Math.min(5, Number(classesMeta.last_page || 1)) },
      (_, index) =>
        Math.max(
          1,
          Math.min(
            Number(classesMeta.page || page) - 2,
            Number(classesMeta.last_page || 1) - 4,
          ),
        ) + index,
    ),
  };
  const selectedProgram = selectablePrograms.find(
    (program) => String(program.id) === String(programId),
  );
  const dialogRow = dialog?.classId
    ? assignableClasses.find((row) => String(row.id) === String(dialog.classId))
    : null;
  const removingRow = removingId
    ? assignableClasses.find((row) => String(row.id) === String(removingId))
    : null;

  function reload() {
    setClassLoading(true);
    setError("");
    return loadClasses(true);
  }

  function openAssignmentDialog(classId, force = false) {
    const cachedCandidates = force ? null : getResourceCacheEntry(candidateCacheKey);
    setNotice("");
    setDialog({ classId, classes: cachedCandidates?.data || null, loading: !cachedCandidates, error: "" });
    if (cachedCandidates) return;
    requestCachedResource(candidateCacheKey, signal => getAdminAssignmentCandidates({ signal }), { force })
      .then(classes => setDialog(current => current && current.classId === classId ? { ...current, classes, loading: false, error: "" } : current))
      .catch(failure => setDialog(current => current && current.classId === classId ? { ...current, loading: false, error: failure.message || "Assignment options could not be loaded." } : current));
  }

  async function saved(changed, message) {
    const applyRows = (current) =>
      current && {
        ...current,
        classes: mergeAssignmentClasses(current.classes, changed),
      };
    updateResourceCache(cacheKey, applyRows);
    updateResourceCache(candidateCacheKey, current => mergeAssignmentClasses(current, changed));
    invalidateResourceCache(key => key === "admin:assignments" || (key.startsWith("admin:assignments:") && key !== cacheKey));
    if (mounted.current) {
      setClassData(applyRows);
      setUpdatedAt(Date.now());
      setDialog(null);
      setRemovingId(null);
      setNotice(message);
    }
  }

  return (
    <section
      aria-label="Instructor assignment management"
      className="space-y-5 font-sans"
    >
      <h1 className="sr-only">Manage</h1>
      {classLoading && !classData ? (
        <LoadingSkeleton
          variant="table"
          rows={5}
          columns={5}
          label="Loading instructor assignments"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Skeleton className="h-10 w-[260px] rounded-lg" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-[170px] rounded-lg" />
            </div>
          </div>
        </LoadingSkeleton>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-0 max-w-[400px] flex-1 basis-64">
                <Input
                  type="search"
                  aria-label="Search instructor assignments"
                  placeholder="Search Instructor, Subject, Program, Section..."
                  value={search}
                  onChange={(event) =>
                    setView((current) => ({
                      ...current,
                      search: event.target.value,
                      page: 1,
                    }))
                  }
                  className="h-10 rounded-[8px] border-slate-300 pr-9! shadow-sm"
                />
                <Search className="pointer-events-none absolute right-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" />
              </div>
              <FilterMenu
                label="Filter instructor assignments"
                chips={
                  programId
                    ? [
                        {
                          name: "program",
                          label: `Program: ${selectedProgram?.program_name || selectedProgram?.name || "Selected program"}`,
                          Icon: GraduationCap,
                        },
                      ]
                    : []
                }
                onChange={(_, value) =>
                  setView((current) => ({
                    ...current,
                    programId: value,
                    page: 1,
                  }))
                }
              >
                <RadioFilterGroup
                  name="program"
                  label="Program"
                  value={programId}
                  onChange={(_, value) =>
                    setView((current) => ({
                      ...current,
                      programId: value,
                      page: 1,
                    }))
                  }
                  options={[
                    { value: "", label: "All programs" },
                    ...selectablePrograms.map((program) => ({
                      value: String(program.id),
                      label:
                        program.program_name ||
                        program.name ||
                        "Unnamed program",
                    })),
                  ]}
                />
              </FilterMenu>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ResourceRefresh
                updatedAt={updatedAt}
                loading={classLoading}
                onRefresh={reload}
              />
              <Button
                type="button"
                disabled={!instructors.length}
                onClick={() => openAssignmentDialog(null)}
                className="h-10 w-[170px] rounded-lg bg-[#172f6b] text-[13px] text-white hover:bg-[#203f8a]"
              >
                <UserRoundArrowLeft className="size-[18px]" />
                Assign Instructor
              </Button>
            </div>
          </div>
          {lookupError && (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span>{lookupError}</span>
              <Button type="button" variant="outline" onClick={() => loadLookups(true)}>
                Retry lookups
              </Button>
            </div>
          )}
          {notice && (
            <p
              role="status"
              className="fixed right-6 top-6 z-50 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg"
            >
              {notice}
            </p>
          )}
          {error ? (
            <div role="alert" className="space-y-3">
              <ErrorState title="Unable to load assignments" message={error} />
              <Button type="button" variant="outline" onClick={reload}>
                Retry loading
              </Button>
            </div>
          ) : !rows.length ? (
            <EmptyState
              title="No instructor assignments"
              message={
                search || programId
                  ? "No assignments match the current search and filters."
                  : "No classes are available for instructor assignment."
              }
            />
          ) : (
            <>
              <div className="px-2.5" aria-busy={classLoading}>
                {classLoading && <p role="status" className="py-2 text-sm text-slate-500">Updating instructor assignments…</p>}
                <Table className="min-w-[850px] table-fixed text-base">
                  <TableHeader>
                    <TableRow className="h-[60px] border-[#172f6b]/40 hover:bg-transparent">
                      {[
                        "Instructor",
                        "Subject",
                        "Program",
                        "Section",
                        "Action",
                      ].map((title) => (
                        <TableHead
                          key={title}
                          className="w-1/5 px-2 py-3 font-bold text-[#172f6b]"
                        >
                          {title}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const assigned = Boolean(activeTeachingAssignment(row));
                      return (
                        <TableRow
                          key={row.id}
                          className="h-[70px] border-[#172f6b]/40 last:border-b!"
                        >
                          <TableCell className="whitespace-normal px-2 py-4 font-medium">
                            {row.displayInstructor}
                          </TableCell>
                          <TableCell className="whitespace-normal px-2 py-4 font-medium">
                            {row.subject_name || "Subject unavailable"}
                          </TableCell>
                          <TableCell className="whitespace-normal px-2 py-4 font-medium">
                            {row.displayProgram}
                          </TableCell>
                          <TableCell className="whitespace-normal px-2 py-4 font-medium">
                            {row.section || "Section unavailable"}
                          </TableCell>
                          <TableCell className="px-2 py-4">
                            <div className="flex flex-wrap items-center gap-1">
                              {assigned ? (
                                <>
                                  <Button
                                    type="button"
                                    disabled={classLoading}
                                    aria-label={`Edit ${row.subject_name}, section ${row.section}`}
                                    onClick={() => {
                                      openAssignmentDialog(row.id);
                                    }}
                                    className="h-7 rounded-sm bg-[#284fac] px-2 text-sm text-white hover:bg-[#203f8a]"
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    disabled={classLoading}
                                    aria-label={`Remove instructor assignment from ${row.subject_name}, section ${row.section}`}
                                    onClick={() => {
                                      setNotice("");
                                      setRemovingId(row.id);
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={classLoading || !instructors.length}
                                  onClick={() => {
                                    openAssignmentDialog(row.id);
                                  }}
                                  className="bg-[#284fac] text-white hover:bg-[#203f8a]"
                                >
                                  Assign instructor
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <RequestPagination
                pagination={pagination}
                total={Number(classesMeta.total || rows.length)}
                onPage={(nextPage) =>
                  setView((current) => ({ ...current, page: nextPage }))
                }
              />
            </>
          )}
        </>
      )}
      {dialog && data && (
        <AssignmentDialog
          row={dialogRow}
          data={{ ...data, classes: dialog.classes || [] }}
          loading={dialog.loading}
          loadError={dialog.error}
          onRetry={() => openAssignmentDialog(dialog.classId, true)}
          onConflict={() => {
            openAssignmentDialog(dialog.classId, true);
            return reload();
          }}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {removingRow && data && (
        <RemoveAssignmentDialog
          row={removingRow}
          instructors={data.instructors}
          onClose={() => setRemovingId(null)}
          onSaved={saved}
        />
      )}
    </section>
  );
}
