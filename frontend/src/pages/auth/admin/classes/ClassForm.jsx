import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { getCurricula, getCurriculum } from "@/api/adminCurricula";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { getSelectablePrograms } from "@/lib/programs";

const years = ["1st", "2nd", "3rd", "4th"];
const semesters = ["1st", "2nd"];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const emptyMeeting = () => ({ day: "Mon", start: "", end: "", room: "" });

function initialForm(item) {
  return {
    program_id: item?.program_id || item?.program?.id || "",
    curriculum_id: "",
    curriculum_subject_id: item?.curriculum_subject_id || "",
    subject_name: item?.subject_name || "",
    year_level: item?.year_level || "",
    semester: item?.semester || "",
    section: item?.section || "",
    school_year: item?.school_year || "",
    schedule: Array.isArray(item?.schedule) ? item.schedule.map((meeting) => ({ ...meeting, room: meeting.room || "" })) : [],
    weekly_hours: item?.weekly_hours ?? "",
    meetings_per_week: item?.meetings_per_week ?? "",
  };
}

function fieldMessage(messages) {
  return Array.isArray(messages) ? messages[0] : messages;
}

function normalizeErrors(error) {
  const source = error?.errors || error?.fieldErrors || error?.body?.errors || {};
  const normalized = {};
  Object.entries(source).forEach(([key, messages]) => {
    normalized[key.startsWith("schedule.") ? "schedule" : key] ||= fieldMessage(messages);
  });
  return normalized;
}

function FieldError({ children }) {
  return children ? <p className="text-xs font-medium text-red-600">{children}</p> : null;
}

function Select({ children, disabled = false, error, label, name, onChange, value }) {
  return <div className="grid gap-2"><Label htmlFor={name}>{label}</Label><select id={name} name={name} value={value} onChange={onChange} disabled={disabled} aria-invalid={Boolean(error)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100 aria-invalid:border-red-500">{children}</select><FieldError>{error}</FieldError></div>;
}

function TextInput({ error, label, name, onChange, type = "text", value }) {
  return <div className="grid gap-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} value={value} onChange={onChange} aria-invalid={Boolean(error)} className="h-10" /><FieldError>{error}</FieldError></div>;
}

export default function ClassForm({ item = null, onCancel, onSave, programs, saving = false }) {
  const [form, setForm] = useState(() => initialForm(item));
  const [curricula, setCurricula] = useState([]);
  const [curriculum, setCurriculum] = useState(null);
  const [loadingCurricula, setLoadingCurricula] = useState(Boolean(item?.program_id || item?.program?.id));
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [errors, setErrors] = useState({});
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!form.program_id) return;
    let alive = true;
    getCurricula(form.program_id)
      .then((data) => { if (alive) setCurricula(data); })
      .catch((error) => { if (alive) { setCurricula([]); setLoadError(error?.message || "Unable to load curriculum versions."); } })
      .finally(() => { if (alive) setLoadingCurricula(false); });
    return () => { alive = false; };
  }, [form.program_id]);

  useEffect(() => {
    if (!form.curriculum_id) return;
    let alive = true;
    getCurriculum(form.curriculum_id)
      .then((data) => { if (alive) setCurriculum(data); })
      .catch((error) => { if (alive) { setCurriculum(null); setLoadError(error?.message || "Unable to load curriculum subjects."); } })
      .finally(() => { if (alive) setLoadingSubjects(false); });
    return () => { alive = false; };
  }, [form.curriculum_id]);

  const subjects = useMemo(() => (Array.isArray(curriculum?.subjects) ? curriculum.subjects : []).filter((subject) => subject.year_level === form.year_level && subject.semester === form.semester), [curriculum, form.semester, form.year_level]);
  const selectedSubject = subjects.find((subject) => String(subject.id) === String(form.curriculum_subject_id));
  const currentSubjectKept = item?.curriculum_subject_id && form.curriculum_subject_id === item.curriculum_subject_id && !selectedSubject;

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => {
      if (name === "program_id") return { ...current, program_id: value, curriculum_id: "", curriculum_subject_id: "", subject_name: "", year_level: "", semester: "" };
      if (name === "curriculum_id") return { ...current, curriculum_id: value, curriculum_subject_id: "", subject_name: "", year_level: "", semester: "" };
      if (name === "year_level" || name === "semester") return { ...current, [name]: value, curriculum_subject_id: "", subject_name: "" };
      if (name === "curriculum_subject_id") {
        const subject = subjects.find((entry) => String(entry.id) === String(value));
        return { ...current, curriculum_subject_id: value, subject_name: subject?.subject_name || current.subject_name };
      }
      return { ...current, [name]: value };
    });
    if (name === "program_id") {
      setCurricula([]);
      setCurriculum(null);
      setLoadingCurricula(Boolean(value));
      setLoadingSubjects(false);
      setLoadError("");
    }
    if (name === "curriculum_id") {
      setCurriculum(null);
      setLoadingSubjects(Boolean(value));
      setLoadError("");
    }
    setErrors((current) => ({ ...current, [name]: "" }));
    setSubmitError("");
  }

  function addMeeting() {
    setForm((current) => ({ ...current, schedule: [...current.schedule, emptyMeeting()] }));
    setErrors((current) => ({ ...current, schedule: "" }));
  }

  function updateMeeting(index, name, value) {
    setForm((current) => ({ ...current, schedule: current.schedule.map((meeting, meetingIndex) => meetingIndex === index ? { ...meeting, [name]: value } : meeting) }));
    setErrors((current) => ({ ...current, schedule: "" }));
  }

  function removeMeeting(index) {
    setForm((current) => ({ ...current, schedule: current.schedule.filter((_, meetingIndex) => meetingIndex !== index) }));
    setErrors((current) => ({ ...current, schedule: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    setErrors({});
    setSubmitError("");
    try {
      await onSave(form);
    } catch (error) {
      setErrors(normalizeErrors(error));
      setSubmitError(error?.message || "Unable to save this class.");
    }
  }

  return <section aria-labelledby="class-form-title" className="rounded-lg border border-slate-200 bg-white p-5">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 id="class-form-title" className="text-lg font-semibold">{item ? "Edit Class" : "Create Class"}</h2><p className="text-sm text-slate-500">Academic units come from the selected curriculum subject. Class/contact hours come from meetings or confirmed hours.</p></div><Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Close</Button></div>
    {(loadError || submitError) && <Alert variant="destructive" className="mb-5"><AlertCircle className="size-4" /><AlertTitle>Unable to continue</AlertTitle><AlertDescription>{submitError || loadError}</AlertDescription></Alert>}
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Select name="program_id" label="Program" value={form.program_id} onChange={change} error={errors.program_id}><option value="">Select program</option>{getSelectablePrograms(programs).map((program) => <option key={program.id} value={program.id}>{program.program_name || program.name}</option>)}</Select>
        <Select name="curriculum_id" label="Curriculum Version" value={form.curriculum_id} onChange={change} disabled={!form.program_id || loadingCurricula} error={errors.curriculum_id}><option value="">{item?.curriculum_subject_id ? "Keep current assigned subject" : loadingCurricula ? "Loading versions..." : "Select version"}</option>{curricula.map((entry) => <option key={entry.id} value={entry.id}>{entry.version}{entry.revision ? ` · Revision ${entry.revision}` : ""}</option>)}</Select>
        <Select name="year_level" label="Year Level" value={form.year_level} onChange={change} disabled={!form.curriculum_id && !currentSubjectKept} error={errors.year_level}><option value="">Select year</option>{years.map((year) => <option key={year} value={year}>{year} Year</option>)}</Select>
        <Select name="semester" label="Semester" value={form.semester} onChange={change} disabled={!form.curriculum_id && !currentSubjectKept} error={errors.semester}><option value="">Select semester</option>{semesters.map((semester) => <option key={semester} value={semester}>{semester} Semester</option>)}</Select>
        <Select name="curriculum_subject_id" label="Subject" value={form.curriculum_subject_id} onChange={change} disabled={loadingSubjects || (!form.curriculum_id && !currentSubjectKept)} error={errors.curriculum_subject_id}><option value="">{loadingSubjects ? "Loading subjects..." : "Select subject"}</option>{currentSubjectKept && <option value={item.curriculum_subject_id}>{item.subject_name} (current assigned subject)</option>}{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code ? `${subject.code} — ` : ""}{subject.subject_name}</option>)}</Select>
        <div className="grid gap-2"><Label>Academic units</Label><Input readOnly value={selectedSubject?.credit_units ?? item?.credit_units ?? "Unavailable"} className="h-10 bg-slate-50" /></div>
        <TextInput name="section" label="Section" value={form.section} onChange={change} error={errors.section} />
        <TextInput name="school_year" label="School Year" value={form.school_year} onChange={change} error={errors.school_year} />
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Class/contact hours</h3><p className="text-xs text-slate-500">Add every weekly meeting, or leave the schedule empty and confirm the weekly totals below.</p></div><Button type="button" variant="outline" onClick={addMeeting} disabled={saving}><Plus className="size-4" />Add Meeting</Button></div>
        <div className="grid gap-3">
          {form.schedule.map((meeting, index) => <div key={`${index}-${meeting.day}`} className="grid items-end gap-3 rounded-md bg-slate-50 p-3 md:grid-cols-[1fr_1fr_1fr_1.3fr_auto]">
            <Select name={`meeting-day-${index}`} label="Day" value={meeting.day} onChange={(event) => updateMeeting(index, "day", event.target.value)}>{days.map((day) => <option key={day} value={day}>{day}</option>)}</Select>
            <TextInput name={`meeting-start-${index}`} label="Start" type="time" value={meeting.start} onChange={(event) => updateMeeting(index, "start", event.target.value)} />
            <TextInput name={`meeting-end-${index}`} label="End" type="time" value={meeting.end} onChange={(event) => updateMeeting(index, "end", event.target.value)} />
            <TextInput name={`meeting-room-${index}`} label="Room (optional)" value={meeting.room} onChange={(event) => updateMeeting(index, "room", event.target.value)} />
            <Button type="button" variant="outline" size="icon" aria-label={`Remove meeting ${index + 1}`} onClick={() => removeMeeting(index)} disabled={saving}><Trash2 className="size-4" /></Button>
          </div>)}
        </div>
        <FieldError>{errors.schedule}</FieldError>
        {form.schedule.length === 0 && <div className="mt-4 grid gap-4 md:grid-cols-2"><TextInput name="weekly_hours" label="Confirmed weekly contact hours" type="number" value={form.weekly_hours} onChange={change} error={errors.weekly_hours} /><TextInput name="meetings_per_week" label="Confirmed meetings per week" type="number" value={form.meetings_per_week} onChange={change} error={errors.meetings_per_week} /></div>}
      </div>

      <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving || loadingCurricula || loadingSubjects} className="bg-[#172f6b] text-white hover:bg-[#203f8a]">{saving && <Spinner />}{saving ? "Saving..." : item ? "Save Changes" : "Create Class"}</Button></div>
    </form>
  </section>;
}
