import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { changeTeachingAssignment } from "@/api/adminAssignments";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getSelectablePrograms } from "@/lib/programs";
import { activeTeachingAssignment, assignedInstructor, assignmentCandidates, assignmentSelection, buildAssignmentPayload, changeAssignmentSelection, classLabel } from "./assignments.js";

const selectStyle = "h-10 w-full rounded-lg border border-[#172f6b]/60 bg-white px-4 text-sm text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-[#284fac] disabled:bg-slate-100 disabled:opacity-70";
const yearOrder = ["1st", "2nd", "3rd", "4th"];
const semesterOrder = ["1st", "2nd"];

function matchesFilters(classRow, selection) {
  return Boolean(classRow)
    && (!selection.programId || String(classRow.program_id) === String(selection.programId))
    && (!selection.yearLevel || classRow.year_level === selection.yearLevel)
    && (!selection.semester || classRow.semester === selection.semester);
}

function instructorIdOf(row, instructors) {
  const assignment = activeTeachingAssignment(row);
  const embedded = assignment?.instructor || assignment?.user || assignment?.assigned_instructor;
  const candidateIds = [row?.instructor_id, assignment?.instructor_id, embedded?.user_id, embedded?.instructor_id, embedded?.id];
  const approved = candidateIds.find(candidate => candidate && instructors.some(item => String(item.id) === String(candidate)));
  if (approved) return String(approved);

  const name = String(embedded?.name || assignment?.instructor_name || row?.instructor?.name || "").trim().toLowerCase();
  const matches = name ? instructors.filter(item => String(item.name || "").trim().toLowerCase() === name) : [];
  return matches.length === 1 ? String(matches[0].id) : "";
}

export default function AssignmentDialog({ row, data, loading = false, loadError = "", onClose, onSaved, onRetry, onConflict }) {
  const dialog = useRef(null);
  const lock = useRef(false);
  const [selection, setSelection] = useState(() => assignmentSelection(row));
  const [action, setAction] = useState(() => row && activeTeachingAssignment(row) ? "change_subject" : "assign");
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const assigning = action === "assign";
  const selectedClass = data.classes.find(item => String(item.id) === String(selection.targetClassId));
  const sourceClass = assigning ? selectedClass : row;
  const targetClass = ["change_subject", "swap"].includes(action) ? selectedClass : null;
  const sourceInstructor = assignedInstructor(sourceClass, data.instructors);
  const sourceInstructorId = instructorIdOf(sourceClass, data.instructors);

  const programNames = useMemo(() => new Map(data.programs.map(program => [String(program.id), program.program_name || program.name || "Unnamed program"])), [data.programs]);
  const candidates = useMemo(() => assignmentCandidates(data.classes, row, action).sort((left, right) => {
    return String(programNames.get(String(left.program_id)) || "").localeCompare(String(programNames.get(String(right.program_id)) || ""), undefined, { sensitivity: "base" })
      || yearOrder.indexOf(left.year_level) - yearOrder.indexOf(right.year_level)
      || semesterOrder.indexOf(left.semester) - semesterOrder.indexOf(right.semester)
      || String(left.subject_name || "").localeCompare(String(right.subject_name || ""), undefined, { sensitivity: "base" })
      || String(left.section || "").localeCompare(String(right.section || ""), undefined, { sensitivity: "base" });
  }), [action, data.classes, programNames, row]);
  const programIds = useMemo(() => new Set(candidates.map(item => String(item.program_id))), [candidates]);
  const programs = useMemo(() => getSelectablePrograms(data.programs.filter(program => programIds.has(String(program.id)))), [data.programs, programIds]);
  const yearLevels = useMemo(() => yearOrder.filter(year => candidates.some(item => (!selection.programId || String(item.program_id) === String(selection.programId)) && item.year_level === year)), [candidates, selection.programId]);
  const semesters = useMemo(() => semesterOrder.filter(semester => candidates.some(item => (!selection.programId || String(item.program_id) === String(selection.programId)) && (!selection.yearLevel || item.year_level === selection.yearLevel) && item.semester === semester)), [candidates, selection.programId, selection.yearLevel]);
  const availableClasses = useMemo(() => candidates.filter(item => matchesFilters(item, selection)), [candidates, selection]);
  const validSelection = Boolean(reason.trim()) && (assigning
    ? Boolean(sourceClass && selection.instructorId)
    : action === "change_instructor"
      ? Boolean(sourceClass && selection.instructorId && selection.instructorId !== sourceInstructorId)
      : Boolean(sourceClass && targetClass && sourceInstructorId));

  useEffect(() => {
    const element = dialog.current;
    if (!element.open) element.showModal();
    return () => { if (element.open) element.close(); };
  }, []);

  function optionLabel(item) {
    const classGroup = item.section || programNames.get(String(item.program_id)) || "Section unavailable";
    return `${item.subject_name || "Subject unavailable"} — ${classGroup} · ${item.year_level || "Year unavailable"} Year · ${item.semester || "Semester unavailable"} Semester · A.Y. ${item.school_year || "Unavailable"}`;
  }

  function change(field, value) {
    setSelection(previous => {
      const next = changeAssignmentSelection(previous, field, value);
      if (field === "instructorId" && previous.instructorId && previous.instructorId !== value) next.targetClassId = "";
      if (["programId", "yearLevel", "semester"].includes(field) && next.targetClassId) {
        const currentClass = data.classes.find(item => String(item.id) === String(next.targetClassId));
        if (!matchesFilters(currentClass, next)) next.targetClassId = "";
      }
      return next;
    });
    setReviewing(false);
    setError("");
  }

  function changeAction(value) {
    setAction(value);
    setSelection(previous => ({ ...previous, instructorId: "", programId: "", yearLevel: "", semester: "", targetClassId: "" }));
    setReviewing(false);
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (!validSelection || lock.current) return;
    if (!reviewing) {
      setReviewing(true);
      return;
    }

    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await changeTeachingAssignment(sourceClass.id, buildAssignmentPayload(action, sourceClass, {
        instructorId: selection.instructorId,
        targetClass,
      }, reason));
      const messages = {
        assign: "Instructor assigned.",
        change_instructor: "Assigned instructor updated.",
        change_subject: "Instructor subject updated.",
        swap: "Instructor assignments swapped.",
      };
      await onSaved(result.classes, messages[action]);
    } catch (failure) {
      const messages = Object.values(failure.errors || {}).flat().filter(value => typeof value === "string");
      setError(messages.join(" ") || failure.message || "The assignment could not be saved.");
      if (failure.status === 409) {
        setReviewing(false);
        await onConflict?.();
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const selectedInstructor = data.instructors.find(item => String(item.id) === String(selection.instructorId));
  const preview = action === "assign"
    ? `${classLabel(sourceClass)}: Unassigned → ${selectedInstructor?.name || "New instructor"}`
    : action === "change_instructor"
      ? `${classLabel(sourceClass)}: ${sourceInstructor?.name || "Current instructor"} → ${selectedInstructor?.name || "New instructor"}`
      : action === "swap"
        ? `${sourceInstructor?.name || "Instructor"}: ${classLabel(sourceClass)} ↔ ${classLabel(targetClass)}`
        : `${sourceInstructor?.name || "Instructor"}: ${classLabel(sourceClass)} → ${classLabel(targetClass)}`;

  if (loading || loadError) return <dialog ref={dialog} aria-labelledby="assignment-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-[620px] rounded-[20px] border border-[#827979] bg-white p-0 text-slate-950 shadow-xl backdrop:bg-black/30">
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5"><h2 id="assignment-dialog-title" className="text-lg font-semibold">Assignment options</h2><Button type="button" variant="ghost" size="icon-sm" aria-label="Close assignment dialog" onClick={onClose}><X className="size-5" /></Button></div>
    <div className="grid gap-4 px-6 py-6">{loading ? <p role="status">Loading assignment options…</p> : <><p role="alert" className="text-sm text-red-700">{loadError}</p><div className="flex justify-end"><Button type="button" variant="outline" onClick={onRetry}>Retry</Button></div></>}</div>
  </dialog>;

  return <dialog ref={dialog} aria-labelledby="assignment-dialog-title" onCancel={event => { event.preventDefault(); if (!lock.current) onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-[620px] overflow-y-auto rounded-[20px] border border-[#827979] bg-white p-0 text-slate-950 shadow-xl backdrop:bg-black/30">
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
      <h2 id="assignment-dialog-title" className="text-lg font-semibold">{assigning ? "Assign Instructor" : "Edit Assignment"}</h2>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Close assignment dialog" disabled={busy} onClick={onClose}><X className="size-5" /></Button>
    </div>
    <form onSubmit={submit} aria-busy={busy} className="grid gap-5 px-6 py-6">
      {!assigning && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold">Current assignment</p><p className="mt-1">{classLabel(sourceClass)} · {sourceClass.semester || "—"} Semester · A.Y. {sourceClass.school_year || "—"}</p><p className="mt-1 text-slate-600">Instructor: {sourceInstructor?.name || "Unassigned"}</p></div>}

      {!assigning && <div className="grid gap-1.5"><Label htmlFor="assignment-action">Action</Label><select id="assignment-action" value={action} disabled={busy} onChange={event => changeAction(event.target.value)} className={selectStyle}><option value="change_instructor">Change instructor</option><option value="change_subject">Change subject</option><option value="swap">Swap assignments</option></select></div>}

      {(assigning || action === "change_instructor") && <div className="grid gap-1.5"><Label htmlFor="assignment-instructor">Instructor</Label><select id="assignment-instructor" required value={selection.instructorId} disabled={busy} onChange={event => change("instructorId", event.target.value)} className={selectStyle}><option value="">Select Instructor</option>{data.instructors.filter(item => action !== "change_instructor" || String(item.id) !== String(sourceInstructorId)).map(item => <option key={item.id} value={item.id}>{item.name || item.email}</option>)}</select></div>}

      {action !== "change_instructor" && <fieldset disabled={busy} className="grid gap-5"><legend className="sr-only">{assigning ? "Filter available classes" : "Select a destination class"}</legend><div className="grid gap-1.5"><Label htmlFor="assignment-program">Program</Label><select id="assignment-program" value={selection.programId} onChange={event => change("programId", event.target.value)} className={selectStyle}><option value="">All programs</option>{programs.map(program => <option key={program.id} value={program.id}>{program.program_name || program.name}</option>)}</select></div><div className="grid gap-4 min-[480px]:grid-cols-2"><div className="grid gap-1.5"><Label htmlFor="assignment-year">Year Level</Label><select id="assignment-year" value={selection.yearLevel} onChange={event => change("yearLevel", event.target.value)} className={selectStyle}><option value="">All year levels</option>{yearLevels.map(year => <option key={year} value={year}>{year} Year</option>)}</select></div><div className="grid gap-1.5"><Label htmlFor="assignment-semester">Semester</Label><select id="assignment-semester" value={selection.semester} onChange={event => change("semester", event.target.value)} className={selectStyle}><option value="">All semesters</option>{semesters.map(semester => <option key={semester} value={semester}>{semester} Semester</option>)}</select></div></div><div className="grid gap-1.5"><Label htmlFor="assignment-class">{action === "swap" ? "Class to swap" : "Available Class"}</Label><select id="assignment-class" required value={selection.targetClassId} onChange={event => change("targetClassId", event.target.value)} className={selectStyle}><option value="">Select Available Class</option>{availableClasses.length === 0 ? <option disabled>No available classes</option> : availableClasses.map(item => <option key={item.id} value={String(item.id)} title={optionLabel(item)}>{optionLabel(item)}</option>)}</select></div></fieldset>}

      <div className="grid gap-1.5"><Label htmlFor="assignment-reason">Reason</Label><textarea id="assignment-reason" required maxLength={1000} value={reason} disabled={busy} onChange={event => { setReason(event.target.value); setReviewing(false); setError(""); }} rows={3} className="w-full rounded-lg border border-[#172f6b]/60 bg-white px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#284fac]" /></div>

      {reviewing && <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm"><h3 className="font-semibold text-[#172f6b]">Before / After preview</h3><p className="mt-2">{preview}</p></section>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-slate-200 pt-5"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !validSelection} className="bg-[#284fac] text-white hover:bg-[#203f8a]">{busy && <LoaderCircle className="size-4 animate-spin" />}{busy ? "Saving…" : reviewing ? "Confirm change" : "Review changes"}</Button></div>
    </form>
  </dialog>;
}
