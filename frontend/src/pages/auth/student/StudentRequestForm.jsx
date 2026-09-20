import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Upload } from "lucide-react";
import { createStudentRequest, getStudentClasses } from "@/api/studentRequests";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/AuthContext";
import { getStoredProfileSetup } from "@/lib/profileSetup";
import StudentPageLayout from "./StudentPageLayout";

const requestOptions = [
  { label: "Student Late Form", value: "late" },
  { label: "Student Absence Form", value: "absence" },
];

const programOptions = [
  "BS Information Systems",
  "Associate in Computer Tech",
  "BA Broadcasting",
  "BS Social Work",
  "BS Accountancy",
  "BS Accounting Info. Systems",
];

const yearOptions = ["1st year", "2nd year", "3rd year", "4th year"];

const absenceReasonOptions = [
  "Illness / Medical Condition",
  "Family Emergency",
  "Official School Activity",
  "Personal Reason",
  "Others",
];

const proofOptions = [
  "Medical Certificate",
  "Prescription / Medical Record",
  "Death Certificate / Funeral Notice",
  "School Activity Endorsement",
  "Letter from Parent/Guardian",
  "Others",
];

const initialForm = {
  requestType: "",
  consent: "",
  studentName: "",
  program: "",
  level: "",
  guardianName: "",
  contactNumber: "",
  dateSubmitted: "",
  minutesLate: "",
  startDateOfAbsence: "",
  endDateOfAbsence: "",
  classId: "",
  classText: "",
  reason: "",
  absenceReasons: [],
  proofTypes: [],
  evidenceFile: null,
  declaration: false,
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function classLabel(item) {
  const instructor = item?.instructor?.name ? ` - ${item.instructor.name}` : "";
  const schedule = item?.schedule ? ` (${item.schedule})` : "";

  return `${item?.subject_name || "Unnamed Class"}${schedule}${instructor}`;
}

function findClassByText(classes, text) {
  const normalizedText = String(text || "").trim().toLowerCase();

  if (!normalizedText) return null;

  return classes.find((item) => {
    const label = classLabel(item).toLowerCase();
    const subject = String(item?.subject_name || "").toLowerCase();

    return label === normalizedText || subject === normalizedText;
  });
}

function requestTitle(type) {
  return type === "absence" ? "Student Absence Form" : "Student Late Form";
}

function normalizePhoneInput(value) {
  const trimmed = String(value || "").trim();

  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "").slice(0, 12)}`;
  }

  return trimmed.replace(/\D/g, "").slice(0, 11);
}

function controlClass(hasError, className) {
  return [
    className,
    hasError
      ? "border-red-500 ring-1 ring-red-200 focus-visible:border-red-500 focus-visible:ring-red-200"
      : "",
  ].join(" ");
}

function RequestShell({ children }) {
  return (
    <div className="mx-auto w-full max-w-[570px]">
      <Card className="overflow-hidden rounded-[5px] border border-slate-300 bg-slate-50 py-0 shadow-none ring-0">
        <div className="h-4 bg-[#173a80]" />
        <CardContent className="grid gap-5 p-5">{children}</CardContent>
      </Card>
    </div>
  );
}

function RequestTitle({ children }) {
  return (
    <h1 className="text-[28px] font-black leading-tight tracking-normal text-slate-950">
      {children}
    </h1>
  );
}

function SectionBox({ children, invalid = false, title }) {
  return (
    <section
      className={[
        "overflow-hidden rounded-[5px] border bg-slate-50",
        invalid ? "border-red-500 ring-1 ring-red-200" : "border-slate-300",
      ].join(" ")}
    >
      {title && (
        <div className="bg-[#173a80] px-4 py-2 text-xs font-black uppercase text-white">
          {title}
        </div>
      )}
      <div className="grid gap-4 p-4">{children}</div>
    </section>
  );
}

function FormNavigation({ backDisabled, nextLabel = "Next", onBack, onNext, submit }) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={backDisabled}
        onClick={onBack}
        className="h-7 rounded-[3px] border-slate-300 px-3 text-xs text-slate-600"
      >
        Back
      </Button>
      <Button
        type={submit ? "submit" : "button"}
        onClick={submit ? undefined : onNext}
        className="h-7 rounded-[3px] bg-[#173a80] px-3 text-xs font-bold text-white hover:bg-[#102b62]"
      >
        {nextLabel}
      </Button>
    </div>
  );
}

function ErrorText({ message }) {
  if (!message) return null;

  return <p className="text-xs font-semibold text-red-600">{message}</p>;
}

function HeaderIdentity({ requestType, user }) {
  return (
    <>
      <RequestTitle>
        {requestTitle(requestType)} -{" "}
        <span className="font-medium">Higher Education Department</span>
      </RequestTitle>
      <p className="text-xs font-bold text-slate-700">
        {user?.email || "student@laverdad.edu.ph"}
      </p>
      <p className="max-w-[480px] text-xs leading-relaxed text-slate-600">
        The name, email address and photo associated with your Google Account
        will be recorded when you upload files and submit this form
      </p>
    </>
  );
}

function StudentRequestForm() {
  const { user } = useAuth();
  const storedProfile = useMemo(() => getStoredProfileSetup(user), [user]);
  const [step, setStep] = useState(0);
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    ...initialForm,
    studentName: user?.name || "",
    program: storedProfile?.program_name || "",
    level: storedProfile?.year_level || "",
    dateSubmitted: today(),
  });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      studentName: current.studentName || user?.name || "",
      program: current.program || storedProfile?.program_name || "",
      level: current.level || storedProfile?.year_level || "",
    }));
  }, [storedProfile, user]);

  useEffect(() => {
    let alive = true;

    async function loadClasses() {
      setClassesLoading(true);
      setClassesError("");

      try {
        const data = await getStudentClasses();
        if (alive) setClasses(data);
      } catch (loadError) {
        if (alive) {
          setClasses([]);
          setClassesError(loadError?.message || "Unable to load your classes.");
        }
      } finally {
        if (alive) setClassesLoading(false);
      }
    }

    loadClasses();

    return () => {
      alive = false;
    };
  }, []);

  function updateField(name, value) {
    setForm((current) => {
      if (name !== "requestType") return { ...current, [name]: value };

      return {
        ...current,
        requestType: value,
        minutesLate: "",
        startDateOfAbsence: "",
        endDateOfAbsence: "",
        reason: "",
        classText: "",
        absenceReasons: [],
        proofTypes: [],
        evidenceFile: null,
        declaration: false,
      };
    });
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setError("");
  }

  function toggleListField(name, value) {
    setForm((current) => {
      const selected = current[name] || [];

      return {
        ...current,
        [name]: selected.includes(value)
          ? selected.filter((item) => item !== value)
          : [...selected, value],
      };
    });
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setError("");
  }

  function handleRadioClick(name, value, event) {
    if (form[name] !== value) return;

    event.preventDefault();
    updateField(name, "");
  }

  function validateStep(currentStep = step) {
    const nextErrors = {};

    if (currentStep === 0 && !form.requestType) {
      nextErrors.requestType = "Select a request.";
    }

    if (currentStep === 2 && form.consent !== "agree") {
      nextErrors.consent = "You must agree before continuing.";
    }

    if (currentStep === 3) {
      if (!form.studentName.trim() || form.studentName.trim().length < 2) {
        nextErrors.studentName = "Enter a valid student name.";
      }
      if (!form.program) nextErrors.program = "Select your program.";
      if (!form.level) nextErrors.level = "Select your level.";
      if (!form.guardianName.trim() || form.guardianName.trim().length < 2) {
        nextErrors.guardianName =
          "Enter a valid parent or guardian's name.";
      } else if (/\d/.test(form.guardianName.trim())) {
        nextErrors.guardianName =
          "Parent or guardian's name must not contain numbers.";
      }
      if (!form.contactNumber.trim()) {
        nextErrors.contactNumber = "Enter your contact number.";
      } else if (!/^(09\d{9}|\+639\d{9})$/.test(form.contactNumber.trim())) {
        nextErrors.contactNumber =
          "Enter a valid phone number starting with 09 or +639.";
      }
      if (!form.dateSubmitted) nextErrors.dateSubmitted = "Choose a date.";
    }

    if (currentStep === 4) {
      if (form.requestType === "late" && !form.minutesLate.trim()) {
        nextErrors.minutesLate = "Enter minutes late.";
      } else if (
        form.requestType === "late" &&
        (!/^\d+$/.test(form.minutesLate.trim()) ||
          Number(form.minutesLate.trim()) <= 0)
      ) {
        nextErrors.minutesLate = "Enter a valid number of minutes.";
      }
      if (form.requestType === "absence" && !form.startDateOfAbsence) {
        nextErrors.startDateOfAbsence = "Choose the start date of absence.";
      }
      if (form.requestType === "absence" && !form.endDateOfAbsence) {
        nextErrors.endDateOfAbsence = "Choose the end date of absence.";
      }
      if (
        form.requestType === "absence" &&
        form.startDateOfAbsence &&
        form.endDateOfAbsence &&
        form.endDateOfAbsence < form.startDateOfAbsence
      ) {
        nextErrors.endDateOfAbsence =
          "End date must be the same as or later than the start date.";
      }
      if (form.requestType === "late" && !form.classId) {
        nextErrors.classId = "Select your class.";
      }
      if (form.requestType === "absence" && !form.classText.trim()) {
        nextErrors.classText = "Enter your program subject/class.";
      }
      if (
        form.requestType === "absence" &&
        form.classText.trim() &&
        classes.length === 0
      ) {
        nextErrors.classText =
          classesError || "Your enrolled classes are unavailable.";
      }
      if (
        form.requestType === "absence" &&
        form.classText.trim() &&
        classes.length > 0 &&
        !findClassByText(classes, form.classText)
      ) {
        nextErrors.classText =
          "Enter a subject/class that matches one of your enrolled classes.";
      }
      if (form.requestType === "late" && !form.reason.trim()) {
        nextErrors.reason = "Enter your reason.";
      } else if (form.requestType === "late" && form.reason.trim().length < 3) {
        nextErrors.reason = "Enter a valid reason.";
      }
      if (form.requestType === "absence" && form.absenceReasons.length === 0) {
        nextErrors.absenceReasons = "Select at least one reason.";
      }
    }

    if (currentStep === 6 && !form.declaration) {
      nextErrors.declaration = "Confirm the declaration before submitting.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function nextStep() {
    if (!validateStep()) return;
    setStep((current) => Math.min(current + 1, 6));
  }

  function previousStep() {
    setFieldErrors({});
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!validateStep(6)) return;

    const isAbsence = form.requestType === "absence";
    const reason = isAbsence
      ? [
          `Reason(s) of absence: ${form.absenceReasons.join(", ")}`,
          `Supporting document(s): ${form.proofTypes.join(", ") || "None selected"}`,
          `Parent/Guardian: ${form.guardianName.trim()}`,
          `Contact: ${form.contactNumber.trim()}`,
        ].join("\n")
      : [
          `Late by ${form.minutesLate.trim()} minute(s).`,
          `Reason: ${form.reason.trim()}`,
          `Parent/Guardian: ${form.guardianName.trim()}`,
          `Contact: ${form.contactNumber.trim()}`,
        ].join("\n");

    setSubmitting(true);
    setError("");

    try {
      const matchedClass =
        form.requestType === "absence"
          ? findClassByText(classes, form.classText)
          : null;

      await createStudentRequest({
        class_id: form.requestType === "absence" ? matchedClass?.class_id : form.classId,
        type: form.requestType,
        start_date_of_absence: isAbsence
          ? form.startDateOfAbsence
          : form.dateSubmitted,
        end_date_of_absence: isAbsence ? form.endDateOfAbsence : null,
        reason,
        evidence_file_url: form.evidenceFile?.name || null,
        evidence_type: form.evidenceFile?.type || null,
      });
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError?.message || "Unable to submit your request.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm({
      ...initialForm,
      studentName: user?.name || "",
      program: storedProfile?.program_name || "",
      level: storedProfile?.year_level || "",
      dateSubmitted: today(),
    });
    setStep(0);
    setError("");
    setFieldErrors({});
    setSubmitted(false);
  }

  if (submitted) {
    return (
      <StudentPageLayout>
        <RequestShell>
          <RequestTitle>
            {requestTitle(form.requestType)} -{" "}
            <span className="font-medium">Higher Education Department</span>
          </RequestTitle>
          <p className="text-sm font-semibold text-slate-950">
            Your response has been recorded.
          </p>
          <button
            type="button"
            onClick={resetForm}
            className="w-fit text-sm font-bold text-[#0b4bd3] hover:underline"
          >
            Submit another response
          </button>
        </RequestShell>
      </StudentPageLayout>
    );
  }

  return (
    <StudentPageLayout>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        {step === 0 && (
          <RequestShell>
            <RequestTitle>
              Request Form - <span className="font-medium">Higher Education Department</span>
            </RequestTitle>
            <div className="mt-6 grid gap-3">
              <Label htmlFor="request-type" className="font-black">
                Request
              </Label>
              <select
                id="request-type"
                value={form.requestType}
                onChange={(event) => updateField("requestType", event.target.value)}
                aria-invalid={Boolean(fieldErrors.requestType)}
                className={controlClass(
                  fieldErrors.requestType,
                  "h-9 rounded-[3px] border border-slate-300 bg-white px-3 text-xs text-slate-700 shadow-none outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                )}
              >
                <option value="">Select a request</option>
                {requestOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ErrorText message={fieldErrors.requestType} />
            </div>
            <FormNavigation backDisabled onNext={nextStep} />
          </RequestShell>
        )}

        {step === 1 && (
          <RequestShell>
            <HeaderIdentity requestType={form.requestType} user={user} />
            <p className="text-sm leading-relaxed text-slate-700">
              This form is used by students of the Higher Education Department
              to formally notify and request approval for{" "}
              {form.requestType === "absence" ? "an Absence" : "a Tardiness"} from
              classes and other academic activities. It serves as an official
              record of the student's{" "}
              {form.requestType === "absence" ? "Absence" : "Tardiness"} and provides the necessary
              information, explanation, and supporting documents for evaluation
              and approval.
            </p>
            <p className="text-sm leading-relaxed text-slate-700">
              Students are required to complete this form accurately and submit
              any relevant proof or documentation supporting their{" "}
              {form.requestType === "absence" ? "Absence" : "Tardiness"}.
              Submission of this form does not automatically grant approval.
              All requests are subject to review and validation in accordance
              with the Student{" "}
              {form.requestType === "absence" ? "Absence" : "Late"} Request
              and Approval Process of the Higher Education Department.
            </p>
            <FormNavigation onBack={previousStep} onNext={nextStep} />
          </RequestShell>
        )}

        {step === 2 && (
          <RequestShell>
            <HeaderIdentity requestType={form.requestType} user={user} />
            <SectionBox title="Data Privacy Notice">
              <p className="text-xs leading-relaxed text-slate-700">
                In compliance with data privacy laws, such as, but not limited
                to, Republic Act No. 10173 Philippine Data Privacy Act of 2012
                and implementing rules and regulations, we from the Higher
                Education Department, within the Organization of La Verdad
                Christian College, Inc. collect, use, store, and process your
                personal information in this form for documentation and tracking
                attendance purposes only, keeping them secured and with
                confidentiality using our organizational, technical, and
                physical security measures.
              </p>
              <p className="text-xs leading-relaxed text-slate-700">
                For your data privacy inquiries, you may reach our Data
                Protection Officer through:
              </p>
              <p className="text-xs font-semibold text-slate-700">
                Email: dpo@laverdad.edu.ph
              </p>
            </SectionBox>

            <SectionBox invalid={Boolean(fieldErrors.consent)} title="Compliance and Consent">
              <p className="text-xs leading-relaxed text-slate-700">
                By ticking "I Agree", I voluntarily give my consent to LVCC in
                collecting, processing, recording, using, and retaining my
                personal information for the above-mentioned purpose in
                accordance with this Privacy Notice.
              </p>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="radio"
                  name="consent"
                  value="agree"
                  checked={form.consent === "agree"}
                  onClick={(event) => handleRadioClick("consent", "agree", event)}
                  onChange={(event) => updateField("consent", event.target.value)}
                />
                I Agree
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="radio"
                  name="consent"
                  value="disagree"
                  checked={form.consent === "disagree"}
                  onClick={(event) =>
                    handleRadioClick("consent", "disagree", event)
                  }
                  onChange={(event) => updateField("consent", event.target.value)}
                />
                I Disagree
              </label>
              <ErrorText message={fieldErrors.consent} />
            </SectionBox>
            <FormNavigation onBack={previousStep} onNext={nextStep} />
          </RequestShell>
        )}

        {step === 3 && (
          <RequestShell>
            <HeaderIdentity requestType={form.requestType} user={user} />
            <SectionBox invalid={Boolean(fieldErrors.studentName)} title="Student Information">
              <div className="grid gap-2">
                <Label>Student Name</Label>
                <Input
                  value={form.studentName}
                  onChange={(event) => updateField("studentName", event.target.value)}
                  placeholder="Add text here..."
                  aria-invalid={Boolean(fieldErrors.studentName)}
                  className={controlClass(
                    fieldErrors.studentName,
                    "h-9 rounded-[3px] border-slate-300 text-xs shadow-none",
                  )}
                />
                <ErrorText message={fieldErrors.studentName} />
              </div>
            </SectionBox>

            <SectionBox invalid={Boolean(fieldErrors.program)} title="Program">
              {programOptions.map((program) => (
                <label key={program} className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="radio"
                    name="program"
                    value={program}
                    checked={form.program === program}
                    onClick={(event) => handleRadioClick("program", program, event)}
                    onChange={(event) => updateField("program", event.target.value)}
                  />
                  {program}
                </label>
              ))}
              <ErrorText message={fieldErrors.program} />
            </SectionBox>

            <SectionBox invalid={Boolean(fieldErrors.level)} title="Level">
              {yearOptions.map((year) => (
                <label key={year} className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="radio"
                    name="level"
                    value={year}
                    checked={form.level === year}
                    onClick={(event) => handleRadioClick("level", year, event)}
                    onChange={(event) => updateField("level", event.target.value)}
                  />
                  {year}
                </label>
              ))}
              <ErrorText message={fieldErrors.level} />
            </SectionBox>

            <SectionBox invalid={Boolean(fieldErrors.guardianName)}>
              <div className="grid gap-2">
                <Label>Parent/Guardian's Name</Label>
                <Input
                  value={form.guardianName}
                  onChange={(event) => updateField("guardianName", event.target.value)}
                  placeholder="Add text here..."
                  aria-invalid={Boolean(fieldErrors.guardianName)}
                  className={controlClass(
                    fieldErrors.guardianName,
                    "h-9 rounded-[3px] border-slate-300 text-xs shadow-none",
                  )}
                />
                <ErrorText message={fieldErrors.guardianName} />
              </div>
            </SectionBox>

            <SectionBox invalid={Boolean(fieldErrors.contactNumber)}>
              <div className="grid gap-2">
                <Label>Contact Number</Label>
                <Input
                  value={form.contactNumber}
                  onChange={(event) =>
                    updateField(
                      "contactNumber",
                      normalizePhoneInput(event.target.value),
                    )
                  }
                  placeholder="Enter Number"
                  aria-invalid={Boolean(fieldErrors.contactNumber)}
                  className={controlClass(
                    fieldErrors.contactNumber,
                    "h-9 rounded-[3px] border-slate-300 text-xs shadow-none",
                  )}
                />
                <ErrorText message={fieldErrors.contactNumber} />
              </div>
            </SectionBox>

            <SectionBox invalid={Boolean(fieldErrors.dateSubmitted)}>
              <div className="grid gap-2">
                <Label>Date Submitted</Label>
                <Input
                  type="date"
                  value={form.dateSubmitted}
                  onChange={(event) => updateField("dateSubmitted", event.target.value)}
                  aria-invalid={Boolean(fieldErrors.dateSubmitted)}
                  className={controlClass(
                    fieldErrors.dateSubmitted,
                    "h-9 rounded-[3px] border-slate-300 text-xs shadow-none",
                  )}
                />
                <ErrorText message={fieldErrors.dateSubmitted} />
              </div>
            </SectionBox>
            <FormNavigation onBack={previousStep} onNext={nextStep} />
          </RequestShell>
        )}

        {step === 4 && (
          <RequestShell>
            <HeaderIdentity requestType={form.requestType} user={user} />
            {form.requestType === "absence" ? (
              <>
                <SectionBox
                  invalid={Boolean(fieldErrors.startDateOfAbsence)}
                  title="Absence Details"
                >
                  <div className="grid gap-2">
                    <Label>Start Date of Absence</Label>
                    <Input
                      type="date"
                      value={form.startDateOfAbsence}
                      onChange={(event) =>
                        updateField("startDateOfAbsence", event.target.value)
                      }
                      aria-invalid={Boolean(fieldErrors.startDateOfAbsence)}
                      className={controlClass(
                        fieldErrors.startDateOfAbsence,
                        "h-9 rounded-[3px] border-slate-300 text-xs shadow-none",
                      )}
                    />
                    <ErrorText message={fieldErrors.startDateOfAbsence} />
                  </div>
                </SectionBox>

                <SectionBox invalid={Boolean(fieldErrors.endDateOfAbsence)}>
                  <div className="grid gap-2">
                    <Label>End Date of Absence</Label>
                    <Input
                      type="date"
                      value={form.endDateOfAbsence}
                      onChange={(event) =>
                        updateField("endDateOfAbsence", event.target.value)
                      }
                      aria-invalid={Boolean(fieldErrors.endDateOfAbsence)}
                      className={controlClass(
                        fieldErrors.endDateOfAbsence,
                        "h-9 rounded-[3px] border-slate-300 text-xs shadow-none",
                      )}
                    />
                    <ErrorText message={fieldErrors.endDateOfAbsence} />
                  </div>
                </SectionBox>
              </>
            ) : (
              <SectionBox
                invalid={Boolean(fieldErrors.minutesLate)}
                title="Tardiness Details"
              >
                <div className="grid gap-2">
                  <Label>How many minutes late?</Label>
                  <Input
                    inputMode="numeric"
                    value={form.minutesLate}
                    onChange={(event) =>
                      updateField("minutesLate", event.target.value)
                    }
                    aria-invalid={Boolean(fieldErrors.minutesLate)}
                    className={controlClass(
                      fieldErrors.minutesLate,
                      "h-9 rounded-[3px] border-slate-300 text-xs shadow-none",
                    )}
                  />
                  <ErrorText message={fieldErrors.minutesLate} />
                </div>
              </SectionBox>
            )}

            <SectionBox
              invalid={Boolean(
                form.requestType === "absence"
                  ? fieldErrors.classText
                  : fieldErrors.classId,
              )}
            >
              <div className="grid gap-2">
                <Label>{form.requestType === "absence" ? "Program" : "Program Subject/Class(es)"}</Label>
                {form.requestType === "absence" ? (
                  <>
                    <div className="grid gap-1 text-[11px] leading-tight text-slate-700">
                      <p className="font-semibold">Subject(s)/Class(es)*</p>
                      <p>
                        please list them in bullet form including the name of the
                        instructor.
                      </p>
                    </div>
                    <div className="grid gap-1 text-[11px] leading-tight text-slate-700">
                      <p className="font-semibold">Example:</p>
                      <ul className="ml-3 list-disc">
                        <li>Mathematics 101 - Mr. Juan Dela Cruz</li>
                        <li>English Communication - Mr. Juan Dela Cruz</li>
                        <li>Information Management - Mr. Juan Dela Cruz</li>
                      </ul>
                    </div>
                    <ul className="sr-only">
                      {classes.map((item) => (
                        <li key={item.class_id}>{classLabel(item)}</li>
                      ))}
                    </ul>
                    <Input
                      value={form.classText}
                      onChange={(event) =>
                        updateField("classText", event.target.value)
                      }
                      aria-invalid={Boolean(fieldErrors.classText)}
                      className={controlClass(
                        fieldErrors.classText,
                        "h-9 rounded-[3px] border-slate-300 text-xs shadow-none",
                      )}
                    />
                  </>
                ) : (
                  <select
                    value={form.classId}
                    onChange={(event) => updateField("classId", event.target.value)}
                    disabled={classesLoading}
                    aria-invalid={Boolean(fieldErrors.classId)}
                    className={controlClass(
                      fieldErrors.classId,
                      "h-9 rounded-[3px] border border-slate-300 bg-white px-3 text-xs text-slate-700 shadow-none outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    )}
                  >
                    <option value="">
                      {classesLoading ? "Loading classes..." : "Select class"}
                    </option>
                    {classes.map((item) => (
                      <option key={item.class_id} value={item.class_id}>
                        {classLabel(item)}
                      </option>
                    ))}
                  </select>
                )}
                {classesError && (
                  <p className="text-xs font-semibold text-red-600">{classesError}</p>
                )}
                <ErrorText
                  message={
                    form.requestType === "absence"
                      ? fieldErrors.classText
                      : fieldErrors.classId
                  }
                />
              </div>
            </SectionBox>

            {form.requestType === "absence" ? (
              <SectionBox invalid={Boolean(fieldErrors.absenceReasons)}>
                <div className="grid gap-2">
                  <Label>Reason of Absence</Label>
                  {absenceReasonOptions.map((reason) => (
                    <label
                      key={reason}
                      className="flex items-center gap-2 text-xs text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={form.absenceReasons.includes(reason)}
                        onChange={() => toggleListField("absenceReasons", reason)}
                      />
                      {reason}
                    </label>
                  ))}
                  <ErrorText message={fieldErrors.absenceReasons} />
                </div>
              </SectionBox>
            ) : (
              <SectionBox invalid={Boolean(fieldErrors.reason)}>
                <div className="grid gap-2">
                  <Label>Reason</Label>
                  <Input
                    value={form.reason}
                    onChange={(event) => updateField("reason", event.target.value)}
                    aria-invalid={Boolean(fieldErrors.reason)}
                    className={controlClass(
                      fieldErrors.reason,
                      "h-9 rounded-[3px] border-slate-300 text-xs shadow-none",
                    )}
                  />
                  <ErrorText message={fieldErrors.reason} />
                </div>
              </SectionBox>
            )}
            <FormNavigation onBack={previousStep} onNext={nextStep} />
          </RequestShell>
        )}

        {step === 5 && (
          <RequestShell>
            <HeaderIdentity requestType={form.requestType} user={user} />
            {form.requestType === "absence" && (
              <SectionBox title="Explanation">
                <div className="grid gap-2">
                  <Label>Supporting Documents / Proof of Absence</Label>
                  {proofOptions.map((proof) => (
                    <label
                      key={proof}
                      className="flex items-center gap-2 text-xs text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={form.proofTypes.includes(proof)}
                        onChange={() => toggleListField("proofTypes", proof)}
                      />
                      {proof}
                    </label>
                  ))}
                </div>
              </SectionBox>
            )}

            <SectionBox title={form.requestType === "late" ? "Explanation" : undefined}>
              <Label>Please attach any applicable supporting document(s):</Label>
              <p className="text-[11px] text-slate-500">
                Upload 1 supported file. Max 10MB.
              </p>
              <label className="inline-flex h-7 w-fit cursor-pointer items-center gap-1 rounded-[3px] border border-blue-200 bg-white px-3 text-xs font-bold text-[#0b4bd3] hover:bg-blue-50">
                <Upload className="size-3" />
                Add File
                <input
                  type="file"
                  className="sr-only"
                  onChange={(event) =>
                    updateField("evidenceFile", event.target.files?.[0] || null)
                  }
                />
              </label>
              {form.evidenceFile && (
                <p className="text-xs font-semibold text-slate-700">
                  {form.evidenceFile.name}
                </p>
              )}
            </SectionBox>
            <FormNavigation onBack={previousStep} onNext={nextStep} />
          </RequestShell>
        )}

        {step === 6 && (
          <RequestShell>
            <HeaderIdentity requestType={form.requestType} user={user} />
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Unable to submit</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <SectionBox
              invalid={Boolean(fieldErrors.declaration)}
              title="Student Declaration"
            >
              <p className="text-sm font-semibold leading-relaxed text-slate-700">
                I hereby certify that the information provided above is true and
                correct. I understand that submission of this form does not
                automatically excuse my{" "}
                {form.requestType === "absence" ? "absence" : "tardiness"} and remains subject to
                verification and approval by the appropriate authority.
              </p>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.declaration}
                  onChange={(event) =>
                    updateField("declaration", event.target.checked)
                  }
                />
                I acknowledge and agree to the statement above.
              </label>
              <ErrorText message={fieldErrors.declaration} />
            </SectionBox>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={previousStep}
                className="h-7 rounded-[3px] border-slate-300 px-3 text-xs text-slate-600"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="h-7 rounded-[3px] bg-[#173a80] px-3 text-xs font-bold text-white hover:bg-[#102b62]"
              >
                {submitting && <Spinner className="mr-1" />}
                Submit
              </Button>
            </div>
          </RequestShell>
        )}
      </form>
    </StudentPageLayout>
  );
}

export default StudentRequestForm;
