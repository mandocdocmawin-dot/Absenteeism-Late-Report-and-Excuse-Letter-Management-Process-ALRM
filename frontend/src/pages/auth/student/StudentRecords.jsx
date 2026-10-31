import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { apiFetch } from "@/api/client";
import { getStudentRequest, openEvidence, updateStudentRequest } from "@/api/studentRequests";
import { useAuth } from "@/context/AuthContext";
import { updateResourceCache } from "@/api/resourceCache";
import { useApiResource } from "@/hooks/useApiResource";
import StatusBadge from "@/components/dashboard/StatusBadge";
import StudentPageLayout from "./StudentPageLayout";
import { LIMITS, proofOptions } from "./request-form/constants";
import { TEXT_INPUT_MAX_LENGTH } from "@/lib/inputLimits";
import { buildRequestEditForm, buildRequestUpdatePayload, proofTypeError } from "./request-form/buildPayload";
import { paginateRecords } from "./records/pagination";
import { filterRecords, reasonOf, recordDate, subjectOf, typeOf } from "./records/recordData";
import RecordsTabs from "./records/RecordsTabs";
import RecordActions from "./records/RecordActions";
import FollowUpNotice from "./records/FollowUpNotice";
import useRequestFollowUp from "./records/useRequestFollowUp";
import LoadingSkeleton from "@/components/loading/LoadingSkeleton";
import TablePageSkeleton from "@/components/loading/TablePageSkeleton";

// Keep My Records data handling, filters, and UI together in this student page.
async function fetchRecords(signal) {
  const response = await apiFetch("/api/requests", { signal });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    throw new Error(body?.message || "Unable to load your records. Please try again.");
  }
  const data = body?.data ?? body;
  const records = Array.isArray(data) ? data : data?.data;
  if (!Array.isArray(records)) throw new Error("The server returned an unexpected records response.");
  return records;
}

function formatDate(value) {
  if (!value) return "—";
  // Calendar dates stay on the submitted day, independently of browser timezone.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00+08:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "2-digit", year: "numeric", timeZone: "Asia/Singapore",
  }).format(date);
}

function RequestEditForm({ record, onSaved, onCancel }) {
  const [form, setForm] = useState(() => buildRequestEditForm(record));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const sourceRef = useRef(record);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const current = await getStudentRequest(record.id, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (current.status !== "pending") throw new Error("This request has already been reviewed and can no longer be edited.");
        sourceRef.current = current;
        setForm(buildRequestEditForm(current));
        setLoading(false);
      } catch (issue) {
        if (!controller.signal.aborted) setError(issue.message || "Unable to load the edit form.");
      }
    }
    load();
    return () => controller.abort();
  }, [record.id]);

  function change(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== name && !key.startsWith(`${name}.`))));
    setError("");
  }

  async function save(event) {
    event.preventDefault();
    if (loading || saving) return;
    if (form.reason.length > LIMITS.reason) {
      setErrors({ reason: `Reason must not exceed ${LIMITS.reason} characters.` });
      setError("Please shorten your reason before saving.");
      return;
    }
    setSaving(true);
    setError("");
    setErrors({});
    try {
      const updated = await updateStudentRequest(record.id, buildRequestUpdatePayload(form));
      onSaved({ ...sourceRef.current, ...updated });
    } catch (issue) {
      setErrors(issue.validationErrors || issue.body?.errors || {});
      setError(issue.message || "Unable to save your changes.");
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (name) => (Array.isArray(errors[name]) ? errors[name].join(" ") : errors[name]) || "";
  const proofError = proofTypeError(errors);
  const control = "w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-800";
  return (
    <form onSubmit={save} className="grid gap-4">
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {loading ? error ? <p className="text-sm text-slate-500">Edit form could not be loaded.</p> : <LoadingSkeleton variant="form" rows={4} label="Loading request details..." /> : <>
        <label className="grid gap-2 text-sm font-semibold">{form.type === "absence" ? "Reason of absence" : "Reason"}
          <textarea required maxLength={LIMITS.reason} value={form.reason} onChange={(event) => change("reason", event.target.value)} aria-invalid={Boolean(errors.reason)} rows={3} className={control} />
          {fieldError("reason") && <span role="alert" className="font-normal text-red-600">{fieldError("reason")}</span>}
        </label>
        {form.type === "absence" ? <>
          {[["start_date_of_absence", "Start date"], ["end_date_of_absence", "End date"]].map(([name, label]) => <label key={name} className="grid gap-2 text-sm">{label}
            <input type="date" required value={form[name]} min={name === "end_date_of_absence" ? form.start_date_of_absence : undefined} onChange={(event) => change(name, event.target.value)} aria-invalid={Boolean(errors[name])} className={control} />
            {fieldError(name) && <span role="alert" className="text-red-600">{fieldError(name)}</span>}
          </label>)}
          <fieldset disabled={saving} aria-describedby={proofError ? "edit-proof-errors" : undefined} className="grid gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <legend className="px-1 text-sm font-semibold">Supporting Documents / Proof of Absence</legend>
            {proofOptions.map((proof) => <label key={proof} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.proof_types.includes(proof)} aria-invalid={Boolean(proofError)} onChange={() => change("proof_types", form.proof_types.includes(proof) ? form.proof_types.filter((value) => value !== proof) : [...form.proof_types, proof])} />{proof}
            </label>)}
            {proofError && <p id="edit-proof-errors" role="alert" className="text-sm text-red-600">{proofError}</p>}
          </fieldset>
        </> : <>
        <label className="grid gap-2 text-sm">Date of tardiness
          <input type="date" required value={form.start_date_of_absence} onChange={(event) => change("start_date_of_absence", event.target.value)} aria-invalid={Boolean(errors.start_date_of_absence)} className={control} />
          {fieldError("start_date_of_absence") && <span role="alert" className="text-red-600">{fieldError("start_date_of_absence")}</span>}
        </label>
        <label className="grid gap-2 text-sm">Minutes late
          <input type="number" required min={1} max={999} value={form.minutes_late} onChange={(event) => change("minutes_late", event.target.value)} aria-invalid={Boolean(errors.minutes_late)} className={control} />
          {fieldError("minutes_late") && <span role="alert" className="text-red-600">{fieldError("minutes_late")}</span>}
        </label></>}
        {form.type !== "absence" && proofError && <p role="alert" className="text-sm text-red-600">{proofError}</p>}
        <p className="text-xs text-slate-500">The existing attachment is kept when you save these changes.</p>
      </>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={loading || saving} className="rounded-lg bg-[#173D83] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save changes"}</button>
      </div>
    </form>
  );
}

export default function StudentRecords() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get("request");
  const recordsKey = `student:records:${user?.id || "unknown"}`;
  const loadRecords = useCallback((_key, signal) => fetchRecords(signal), []);
  const resource = useApiResource(loadRecords, user?.id || "", { cacheKey: recordsKey, initialData: [] });
  const records = useMemo(() => resource.data || [], [resource.data]);
  const { loading, error } = resource;
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [recordType, setRecordType] = useState("absence");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [openingAttachment, setOpeningAttachment] = useState(false);
  const dialogRef = useRef(null);
  const { followingUpId, cooldownSecondsById, notice, followUp, dismissNotice } = useRequestFollowUp(user?.id);

  useEffect(() => {
    const record = records.find((item) => item.id === requestedId);
    if (!record) return;
    const timer = window.setTimeout(() => {
      if (["absence", "late"].includes(record.type)) setRecordType(record.type);
      setSubject("");
      setPage(1);
      setSelected(record);
      setEditing(false);
      setAttachmentError("");
      if (!dialogRef.current.open) dialogRef.current.showModal();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [records, requestedId]);

  const typeRecords = useMemo(() => records.filter((record) => record.type === recordType), [records, recordType]);
  const subjects = useMemo(() => [...new Set(typeRecords.map(subjectOf))].sort(), [typeRecords]);
  const visibleRecords = useMemo(() => filterRecords(records, recordType, search, subject), [records, recordType, search, subject]);

  const { totalPages, currentPage, firstRecord, pageRecords, pageButtons } = paginateRecords(visibleRecords, page);

  function changeRecordType(value) {
    if (!["absence", "late"].includes(value)) return;
    setRecordType(value);
    setSubject("");
    setPage(1);
  }

  function refresh() {
    setPage(1);
    resource.reload();
  }

  function viewRecord(record) {
    setSelected(record);
    setEditing(false);
    setAttachmentError("");
    dialogRef.current.showModal();
  }

  async function viewAttachment() {
    if (!selected || openingAttachment) return;
    setOpeningAttachment(true);
    setAttachmentError("");
    try {
      await openEvidence(selected.id);
    } catch (attachmentIssue) {
      setAttachmentError(attachmentIssue.message || "Unable to open the attachment.");
    } finally {
      setOpeningAttachment(false);
    }
  }

  const inputClass = "h-10 rounded-[5px] border border-[#9FAFCE] bg-white text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const paginationClass = "inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-md border border-[#CBD4E6] px-3 text-sm font-medium text-[#173D83] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800";

  return (
    <StudentPageLayout contentPadding="px-5 sm:px-[50px]">
      <section aria-label="My Records" className="grid min-w-0 w-full gap-2">
        <h1 className="sr-only">My Records</h1>
        {loading ? <TablePageSkeleton layout="student-records" label="Loading your records..." /> : <RecordsTabs value={recordType} onValueChange={changeRecordType}>
        <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-[220px] max-w-full">
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-3 size-4 text-slate-400" />
            <input aria-label="Search records" placeholder="Search Name..." maxLength={TEXT_INPUT_MAX_LENGTH} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className={`${inputClass} w-full pl-8 pr-3`} />
          </div>
          <div className="relative w-[190px] max-w-full">
            <select aria-label="Filter by subject" value={subject} onChange={(event) => { setSubject(event.target.value); setPage(1); }} className={`${inputClass} w-full appearance-none pl-3 pr-8`}>
              <option value="">All subjects</option>
              {subjects.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </div>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{error} <button type="button" onClick={refresh} className="ml-2 font-semibold underline">Try again</button></div>}
        <FollowUpNotice notice={notice} onDismiss={dismissNotice} />
        <div aria-busy={loading} className="overflow-x-auto">
          <table className="w-full min-w-[820px] table-auto border-collapse text-left text-sm leading-5">
            <colgroup><col /><col className="w-[20%]" /><col className="w-[18%]" /><col className="w-[228px]" /></colgroup>
            <thead className="text-sm font-bold text-[#101C4A] dark:text-blue-200">
              <tr className="border-b border-[#AEBBD5] dark:border-slate-700">
                <th scope="col" className="px-4 py-3">Subject</th>
                <th scope="col" className="px-4 py-3">Date</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">Records could not be loaded.</td></tr>
              ) : visibleRecords.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">{typeRecords.length ? "No records match your search or subject filter." : `You have no submitted ${recordType === "absence" ? "absence" : "late"} requests yet.`}</td></tr>
              ) : pageRecords.map((record) => (
                <tr key={record.id} className="border-b border-[#C5CEE0] hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900">
                  <td className="break-words px-4 py-4">{subjectOf(record)}</td>
                  <td className="whitespace-nowrap px-4 py-4">{formatDate(recordDate(record))}</td>
                  <td className="px-4 py-4"><StatusBadge value={record.status} /></td>
                  <td className="px-4 py-4"><RecordActions record={record} onView={viewRecord} description={`${subjectOf(record)}, ${formatDate(recordDate(record))}`} onFollowUp={followUp} followingUpId={followingUpId} cooldownSeconds={cooldownSecondsById[record.id] || 0} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !error && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className="text-sm text-slate-500">
              {visibleRecords.length ? `Showing ${firstRecord + 1}–${firstRecord + pageRecords.length} of ${visibleRecords.length} records` : "0 records"}
            </p>
            <nav aria-label="Records pagination" className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className={paginationClass}>
                <ChevronLeft aria-hidden="true" className="size-3.5" />Previous
              </button>
              {pageButtons.map((number) => (
                <button key={number} type="button" aria-label={`Page ${number}`} aria-current={number === currentPage ? "page" : undefined} disabled={!visibleRecords.length} onClick={() => setPage(number)} className={`${paginationClass} ${number === currentPage ? "border-[#173D83] bg-[#173D83] text-white hover:bg-[#101C4A] dark:border-blue-500 dark:bg-blue-600 dark:text-white" : ""}`}>
                  {number}
                </button>
              ))}
              <button type="button" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className={paginationClass}>
                Next<ChevronRight aria-hidden="true" className="size-3.5" />
              </button>
            </nav>
          </div>
        )}
        </div>
        </RecordsTabs>}
      </section>

      <dialog ref={dialogRef} aria-labelledby="record-dialog-title" onClose={() => {
        if (requestedId) setSearchParams((params) => { params.delete("request"); return params; }, { replace: true });
      }} onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
      }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2 id="record-dialog-title" className="text-lg font-bold">{editing ? "Edit request" : "Record details"}</h2>
          <button type="button" aria-label="Close record" onClick={() => dialogRef.current.close()} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="size-5" /></button>
        </div>
        {selected && <div className="grid gap-5 p-6">
          {editing ? <RequestEditForm key={selected.id} record={selected} onCancel={() => setEditing(false)} onSaved={(updated) => {
            setSelected(updated);
            updateResourceCache(recordsKey, (current) => current.map((record) => record.id === updated.id ? updated : record));
            setEditing(false);
          }} /> : <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm">
            <dt className="text-slate-500">Subject</dt><dd className="font-semibold">{subjectOf(selected)}</dd>
            <dt className="text-slate-500">Request type</dt><dd>{typeOf(selected)}</dd>
            <dt className="text-slate-500">Status</dt><dd><StatusBadge value={selected.status} /></dd>
            <dt className="text-slate-500">Date submitted</dt><dd>{formatDate(selected.date_submitted || selected.created_at)}</dd>
            {selected.type === "absence" ? <>
              <dt className="text-slate-500">Absence dates</dt><dd>{formatDate(selected.start_date_of_absence)}{selected.end_date_of_absence && selected.end_date_of_absence !== selected.start_date_of_absence ? ` – ${formatDate(selected.end_date_of_absence)}` : ""}</dd>
            </> : <>
              <dt className="text-slate-500">Date of tardiness</dt><dd>{formatDate(selected.start_date_of_absence)}</dd>
              <dt className="text-slate-500">Minutes late</dt><dd>{selected.minutes_late ?? "—"}</dd>
            </>}
          </dl>
          <div><h3 className="mb-2 text-sm font-semibold">{selected.type === "absence" ? "Reason of absence" : "Reason"}</h3><p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 text-sm leading-relaxed dark:bg-slate-800">{reasonOf(selected)}</p></div>
          <div><h3 className="mb-2 text-sm font-semibold">Supporting documents / Proof types</h3>
            {Array.isArray(selected.proof_types) && selected.proof_types.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{selected.proof_types.map((proof, index) => <li key={`${proof}-${index}`}>{proof}</li>)}</ul> : <p className="text-sm text-slate-500">None selected</p>}
          </div>
          {selected.evidence_file_url && <button type="button" disabled={openingAttachment} onClick={viewAttachment} className="justify-self-start rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-slate-800">{openingAttachment ? "Opening attachment..." : selected.evidence_type === "application/pdf" ? "Download attachment" : "View attachment"}</button>}
          {attachmentError && <p role="alert" className="text-sm text-red-600">{attachmentError}</p>}
          {selected.status === "pending" && <button type="button" onClick={() => setEditing(true)} className="justify-self-start rounded-lg bg-[#173D83] px-4 py-2 text-sm font-semibold text-white">Edit request</button>}
          </>}
        </div>}
      </dialog>
    </StudentPageLayout>
  );
}
