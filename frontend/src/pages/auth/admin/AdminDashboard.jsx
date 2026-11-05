import { useCallback, useEffect, useRef, useState } from "react";
import {
  createClass,
  createProgram,
  deleteClass,
  deleteProgram,
  getAdminDashboard,
  getClasses,
  getPrograms,
  updateClass,
  updateStaffRole,
} from "@/api/admin";
import { getPendingUserPreview, getUserManagementUsers } from "@/api/adminUserManagement";
import { getResourceCacheEntry, requestCachedResource } from "@/api/resourceCache";
import AdminOverview from "./dashboard/AdminOverview";
import AdminReports from "./reports/AdminReports";
import PageBreadcrumbs from "@/components/navigation/PageBreadcrumbs";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SectionPlaceholder } from "@/components/loading/DashboardSkeleton/StaffDashboardPlaceholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isGeneralEducationProgram } from "@/lib/programs";
import ClassForm from "./classes/ClassForm";

const emptyProgramForm = { program_name: "", program_head_id: "" };
const endpoints = { dashboard: getAdminDashboard, users: getUserManagementUsers, pendingUsers: getPendingUserPreview, programs: getPrograms, classes: getClasses };
const resourceDefaults = { dashboard: false, users: false, pendingUsers: false, programs: false, classes: false };
const viewResources = { dashboard: ["dashboard", "pendingUsers"], users: ["users"], programs: ["programs", "users"], classes: ["classes", "programs"], reports: ["programs"] };

function hoursValue(value) {
  if (value === null || value === undefined || value === "") return "Unavailable";
  const hours = Number(value);
  if (!Number.isFinite(hours)) return "Unavailable";
  return hours;
}

function hoursLabel(value) {
  const hours = hoursValue(value);
  return hours === "Unavailable" ? hours : `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

export function ClassHours({ item }) {
  return <dl className="mt-3 grid gap-1 text-xs text-slate-600"><div><dt className="inline font-medium">Academic units:</dt> <dd className="inline">{hoursValue(item.weekly_hours)}</dd></div><div><dt className="inline font-medium">Class/contact hours:</dt> <dd className="inline">{hoursLabel(item.weekly_hours)}</dd></div></dl>;
}

export function CreateClassButton(props) {
  return <Button type="button" className="h-10 bg-[#172f6b] px-4 text-white hover:bg-[#203f8a]" {...props}>Create Class</Button>;
}

function initialResources(view) {
  const cached = Object.fromEntries(Object.keys(endpoints).map((key) => [key, getResourceCacheEntry(`admin:${key}`)]));
  const requested = viewResources[view] || [];
  return {
    dashboard: cached.dashboard?.data || null,
    users: cached.users?.data || [], pendingUsers: cached.pendingUsers?.data || [],
    programs: cached.programs?.data || [], classes: cached.classes?.data || [],
    loading: { ...resourceDefaults, ...Object.fromEntries(requested.map((key) => [key, !cached[key]])) }, errors: {},
    ready: Object.fromEntries(Object.entries(cached).map(([key, entry]) => [key, Boolean(entry)])),
  };
}

export function AdminDashboard({ view = "dashboard" }) {
  const [resources, setResources] = useState(() => initialResources(view));
  const { users, programs, classes, loading: resourceLoading, errors, ready } = resources;
  const visiblePrograms = programs.filter(program => !isGeneralEducationProgram(program));
  const generalEducationIds = new Set(programs.filter(isGeneralEducationProgram).map(program => program.id));
  const visibleClasses = classes.filter(item => !generalEducationIds.has(item.program_id) && !isGeneralEducationProgram(item.program));
  const generation = useRef(0);
  const mounted = useRef(false);
  const [programForm, setProgramForm] = useState(emptyProgramForm);
  const [roleSelections, setRoleSelections] = useState({});
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [classEditor, setClassEditor] = useState(null);

  const loadData = useCallback(async ({ force = false } = {}) => {
    if (!mounted.current) return;
    const request = ++generation.current;
    const requested = viewResources[view] || [];
    setResources((previous) => ({ ...previous, loading: { ...resourceDefaults, ...Object.fromEntries(requested.map(key => [key, force || !getResourceCacheEntry(`admin:${key}`)])) }, errors: {} }));
    // Await completion for mutation callers; each resource publishes as it settles.
    await Promise.allSettled(requested.map(async (key) => {
      const fetchData = endpoints[key];
      try {
        const data = await requestCachedResource(`admin:${key}`, () => fetchData(), { force });
        if (request !== generation.current) return;
        const valid = key === "dashboard" ? data && typeof data === "object" && !Array.isArray(data) : Array.isArray(data);
        if (!valid) throw new Error(`Unexpected ${key} response.`);
        setResources((previous) => ({
          ...previous, [key]: data,
          loading: { ...previous.loading, [key]: false },
          ready: { ...previous.ready, [key]: true },
          errors: { ...previous.errors, [key]: "" },
        }));
      } catch (requestError) {
        if (request !== generation.current) return;
        setResources((previous) => ({
          ...previous,
          loading: { ...previous.loading, [key]: false },
          errors: { ...previous.errors, [key]: requestError?.message || `Could not load ${key}.` },
        }));
      }
    }));
  }, [view]);

  useEffect(() => {
    const requests = generation;
    mounted.current = true;
    const timer = window.setTimeout(loadData, 0);
    return () => { window.clearTimeout(timer); mounted.current = false; requests.current++; };
  }, [loadData]);

  function updateProgramForm(event) {
    const { name, value } = event.target;
    setProgramForm((current) => ({ ...current, [name]: value }));
  }

  async function runAction(action, successMessage) {
    setError("");
    setNotice("");

    try {
      await action();
      if (!mounted.current) return false;
      setNotice(successMessage);
      await loadData({ force: true });
      return mounted.current;
    } catch (requestError) {
      if (mounted.current) setError(requestError.message);
      return false;
    } finally {
      if (mounted.current) setWorking("");
    }
  }

  async function handleCreateProgram(event) {
    event.preventDefault();
    if (!programOptionsReady || working) return;
    if (programForm.program_head_id && !programHeads.some(user => String(user.id) === programForm.program_head_id)) { setError("Select a program head from the available list."); return; }
    setWorking("create-program");
    const created = await runAction(
      () => createProgram({ program_name: programForm.program_name, program_head_id: programForm.program_head_id || null }),
      "Program created.",
    );
    if (created) setProgramForm(emptyProgramForm);
  }

  async function handleSaveClass(values) {
    if (working) return;
    setWorking("save-class");
    setError("");
    setNotice("");
    try {
      if (classEditor?.item) await updateClass(classEditor.item.id, values);
      else await createClass(values);
      if (!mounted.current) return;
      setNotice(classEditor?.item ? "Class updated." : "Class created.");
      setClassEditor(null);
      await loadData({ force: true });
    } finally {
      if (mounted.current) setWorking("");
    }
  }

  const loading = (viewResources[view] || []).some((key) => resourceLoading[key]);
  const waiting = (key) => resourceLoading[key] && !ready[key];
  const programOptionsReady = ready.users && !resourceLoading.users && !errors.users;
  function resourceError(key) {
    return <div className="space-y-2"><ErrorState title={`Could not load ${key}`} message={errors[key]} /><button type="button" onClick={() => { void loadData(); }} className="text-sm font-medium text-blue-800 underline dark:text-blue-300">Retry loading</button></div>;
  }
  const showUsers = view === "users";
  const showPrograms = view === "programs";
  const showClasses = view === "classes";
  const showReports = view === "reports";
  const staffUsers = users.filter((user) => ["instructor", "program_head", "administrator"].includes(user.role));
  const programHeads = users.filter((user) => ["instructor", "program_head"].includes(user.role));

  if (view === "dashboard") return <AdminOverview resources={resources} onRetry={() => loadData({ force: true })} />;

  return (
    <div className="space-y-6" data-slot={view === "dashboard" && loading ? "dashboard-skeleton" : undefined} data-variant={view === "dashboard" ? "admin" : undefined}>
      {showClasses && <PageBreadcrumbs items={[{ label: "Manage", to: "/manage" }, { label: "Manage Classes" }]} />}
      {showPrograms && <PageBreadcrumbs items={[{ label: "Program Overview", to: "/program-overview" }, { label: "Manage Programs" }]} />}
      {loading ? <span role="status" aria-busy="true" className="sr-only">Loading administrator data</span> : null}
      {error ? <ErrorState message={error} /> : null}
      {notice ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      {showUsers ? waiting("users") ? <SectionPlaceholder rows={5} /> : errors.users ? resourceError("users") : <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold">Staff role assignment</h2>
        {staffUsers.length === 0 ? <EmptyState title="No staff accounts" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <tbody className="divide-y divide-slate-100">
                {staffUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3"><StatusBadge value={user.status} /></td>
                    <td className="px-4 py-3">
                      <select value={roleSelections[user.id] || user.role} onChange={(event) => setRoleSelections((current) => ({ ...current, [user.id]: event.target.value }))} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm">
                        <option value="instructor">Instructor</option>
                        <option value="program_head">Program Head</option>
                        <option value="administrator">Administrator</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" disabled={Boolean(working) || (roleSelections[user.id] || user.role) === user.role} onClick={() => { setWorking(`role-${user.id}`); runAction(() => updateStaffRole(user.id, roleSelections[user.id]), "Staff role assigned."); }}>Assign role</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section> : null}

      {(showPrograms || showClasses) ? <section className="grid min-w-0 gap-6">
        {showPrograms ? waiting("programs") ? <SectionPlaceholder form /> : errors.programs ? resourceError("programs") : <div className="rounded-lg border border-slate-200 bg-white p-5 text-[#0D1526]">
          <h2 className="mb-4 text-lg font-semibold">Programs</h2>
          {!showUsers && errors.users ? resourceError("users") : null}
          <form className="mb-6 grid items-end gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_140px]" onSubmit={handleCreateProgram}>
            <div className="min-w-0 space-y-2"><Label htmlFor="program_name">Program name</Label><Input id="program_name" name="program_name" value={programForm.program_name} onChange={updateProgramForm} className="h-11 rounded-lg text-[#0D1526]" required /></div>
            <div className="min-w-0 space-y-2"><Label htmlFor="program_head_id">Program head</Label><select id="program_head_id" name="program_head_id" disabled={!programOptionsReady} value={programForm.program_head_id} onChange={updateProgramForm} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-[#0D1526]"><option value="">Unassigned</option>{programHeads.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></div>
            <div className="flex items-end md:col-span-2 xl:col-span-1"><Button type="submit" disabled={!programOptionsReady || working === "create-program"} className="h-11 w-full rounded-lg bg-[#172f6b] px-6 text-white hover:bg-[#203f8a] sm:w-[140px] xl:w-full">Create</Button></div>
          </form>
          {visiblePrograms.length === 0 ? <EmptyState title="No programs found" /> : (
            <div className="grid gap-4 lg:grid-cols-2">{visiblePrograms.map((program) => <article key={program.id} className="min-w-0 rounded-lg border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><span className="min-w-0 break-words font-medium">{program.program_name}</span><Button size="sm" variant="destructive" className="shrink-0" onClick={() => { setWorking(`delete-program-${program.id}`); runAction(() => deleteProgram(program.id), "Program deleted."); }}>Delete</Button></div><p className="mt-2 break-words text-xs text-slate-500">ID {program.id} · {program.classes_count || 0} classes</p></article>)}</div>
          )}
        </div> : null}

        {showClasses ? waiting("classes") || waiting("programs") || waiting("users") ? <SectionPlaceholder rows={3} /> : errors.classes ? resourceError("classes") : <div className="grid min-w-0 gap-6">
          {!showPrograms && errors.programs ? resourceError("programs") : null}
          {errors.users ? resourceError("users") : null}
          <div className="flex justify-end"><CreateClassButton onClick={() => setClassEditor({ item: null })} disabled={Boolean(working)} /></div>
          {classEditor && <ClassForm key={classEditor.item?.id || "new"} item={classEditor.item} programs={visiblePrograms} saving={working === "save-class"} onCancel={() => setClassEditor(null)} onSave={handleSaveClass} />}
          <section aria-labelledby="existing-classes-title" className="min-w-0 rounded-lg border border-slate-200 bg-white p-5">
          <h2 id="existing-classes-title" className="mb-4 text-lg font-semibold">Existing Classes</h2>
          {visibleClasses.length === 0 ? <EmptyState title="No classes found" /> : (
            <div className="grid gap-3 lg:grid-cols-2">{visibleClasses.map((item) => <article key={item.id} className="min-w-0 rounded-lg border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><span className="min-w-0 break-words font-medium">{item.subject_name}</span><div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" onClick={() => setClassEditor({ item })} disabled={Boolean(working)}>Edit</Button><Button size="sm" variant="destructive" onClick={() => { setWorking(`delete-class-${item.id}`); runAction(() => deleteClass(item.id), "Class deleted."); }}>Delete</Button></div></div><p className="mt-2 break-words text-xs text-slate-500">{item.program?.program_name || "Program"} · {item.year_level || "Year unavailable"} · {item.semester || "Semester unavailable"} Semester</p><ClassHours item={item} /></article>)}</div>
          )}
          </section>
        </div> : null}
      </section> : null}

      {showReports ? waiting("programs") ? <SectionPlaceholder form rows={0} /> : errors.programs ? resourceError("programs") : <AdminReports programs={programs} /> : null}
    </div>
  );
}
