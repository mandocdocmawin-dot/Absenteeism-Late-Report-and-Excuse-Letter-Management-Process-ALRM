import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Upload } from "lucide-react";
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

const associateProgram = "Associate in Computer Technology";

const programOptions = [
  associateProgram,
  "BA in Broadcasting",
  "BS in Accountancy",
  "BS in Accountancy Information Systems",
  "BS in Information Systems",
  "BS in Social Work",
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

function flowSteps(requestType) {
  return [
    "Request",
    "Instructions",
    "Privacy",
    "Student Info",
    requestType === "absence" ? "Absence Details" : "Late Details",
    "Attachment",
    "Review",
  ];
}

function normalizePhoneInput(value) {
  const trimmed = String(value || "").trim();

  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "").slice(0, 12)}`;
  }

  return trimmed.replace(/\D/g, "").slice(0, 11);
}

function yearOptionsForProgram(program) {
  return program === associateProgram ? yearOptions.slice(0, 2) : yearOptions;
}

function controlClass(hasError, className = "") {
  return [
    className,
    "border-[1.5px] bg-[#FBFBFD] transition-colors focus-visible:border-[#101C4A] focus-visible:ring-[#101C4A]/15",
    hasError
      ? "border-red-500 ring-2 ring-red-100 focus-visible:border-red-500 focus-visible:ring-red-100"
      : "border-slate-200",
  ]
    .filter(Boolean)
    .join(" ");
}

function RequestPageCanvas({ children }) {
  return (
    <div className="-mx-5 -my-7 min-h-[calc(100vh-70px)] bg-[#F5F6FA] px-5 py-8 transition-colors dark:bg-slate-950 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
      {children}
    </div>
  );
}

function RequestStepper({ currentStep, requestType }) {
  const steps = flowSteps(requestType);
  const fillWidth =
    steps.length <= 1 ? 0 : (currentStep / (steps.length - 1)) * 100;

  return (
    <div className="mb-8 w-full px-4 sm:px-6">
      <div className="relative flex items-start justify-between">
        <div className="absolute left-[19px] right-[19px] top-[19px] h-0.5 bg-slate-200">
          <div
            className="h-0.5 bg-[#2E9E6B] transition-all duration-500"
            style={{ width: `${fillWidth}%` }}
          />
        </div>

        {steps.map((label, index) => {
          const done = index < currentStep;
          const active = index === currentStep;

          return (
            <div
              key={`${label}-${index}`}
              className={[
                "relative z-10 flex flex-1 flex-col items-center",
                index === 0 ? "items-start" : "",
                index === steps.length - 1 ? "items-end" : "",
              ].join(" ")}
            >
              <div
                className={[
                  "flex size-[38px] items-center justify-center rounded-full border-2 text-sm font-bold transition-all",
                  done
                    ? "border-[#2E9E6B] bg-[#2E9E6B] text-white"
                    : active
                      ? "border-[#101C4A] bg-[#101C4A] text-white shadow-[0_0_0_5px_rgba(16,28,74,0.12)]"
                      : "border-slate-200 bg-white text-slate-400",
                ].join(" ")}
              >
                {done ? <Check className="size-5" strokeWidth={3} /> : index + 1}
              </div>
              <p
                className={[
                  "mt-2 hidden max-w-[90px] text-center text-xs font-medium sm:block",
                  active
                    ? "font-bold text-[#101C4A]"
                    : done
                      ? "text-slate-900"
                      : "text-slate-400",
                  index === 0 ? "text-left" : "",
                  index === steps.length - 1 ? "text-right" : "",
                ].join(" ")}
              >
                {label}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs font-medium text-slate-500">
        Step {currentStep + 1} of {steps.length} - {steps[currentStep]}
      </p>
    </div>
  );
}

function RequestShell({ children, requestType, step }) {
  return (
    <div className="mx-auto w-full max-w-[760px]">
      <RequestStepper currentStep={step} requestType={requestType} />
      <Card className="rounded-2xl border border-slate-200 bg-white py-0 shadow-sm">
        <CardContent className="grid gap-5 px-5 py-7 sm:px-10 sm:py-9">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

function RequestTitle({ children }) {
  return (
    <h1 className="text-[22px] font-black leading-tight tracking-normal text-slate-950 sm:text-2xl">
      {children}
    </h1>
  );
}

function Eyebrow({ step, requestType }) {
  const steps = flowSteps(requestType);

  return (
    <p className="text-xs font-bold text-[#2E9E6B]">
      Step {step + 1} of {steps.length}
    </p>
  );
}

function SectionBox({ children, invalid = false, title }) {
  return (
    <section
      className={[
        "grid gap-4 rounded-[10px] border bg-[#F7F8FC] p-4",
        invalid ? "border-red-500 ring-2 ring-red-100" : "border-slate-200",
      ].join(" ")}
    >
      {title && (
        <h2 className="text-sm font-black uppercase tracking-normal text-[#101C4A]">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

function FormNavigation({
  backDisabled,
  nextLabel = "Continue",
  onBack,
  onNext,
  submit,
}) {
  return (
    <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-5">
      <Button
        type="button"
        variant="outline"
        disabled={backDisabled}
        onClick={onBack}
        className={[
          "h-11 rounded-[9px] border-[1.5px] border-slate-200 px-5 text-sm font-bold text-slate-500 hover:text-slate-950",
          backDisabled ? "pointer-events-none opacity-0" : "",
        ].join(" ")}
      >
        Back
      </Button>
      <Button
        type={submit ? "submit" : "button"}
        onClick={submit ? undefined : onNext}
        className="h-11 rounded-[9px] bg-[#101C4A] px-6 text-sm font-bold text-white hover:bg-[#1B2B6B]"
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

function HeaderIdentity({ requestType, step, user }) {
  return (
    <div className="grid gap-2">
      <Eyebrow step={step} requestType={requestType} />
      <RequestTitle>
        {requestTitle(requestType)} -{" "}
        <span className="font-medium">Higher Education Department</span>
      </RequestTitle>
      <p className="text-xs font-bold text-slate-700">
        {user?.email || "student@laverdad.edu.ph"}
      </p>
      <p className="max-w-[520px] text-sm leading-relaxed text-slate-500">
        The name, email address and photo associated with your Google Account
        will be recorded when you upload files and submit this form.
      </p>
    </div>
  );
}

function FieldLabel({ children }) {
  return <Label className="text-sm font-bold text-slate-900">{children}</Label>;
}

function OptionLabel({ children }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-[9px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:border-[#101C4A]/40">
      {children}
    </label>
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
      if (name === "program") {
        const allowedYears = yearOptionsForProgram(value);

        return {
          ...current,
          program: value,
          level: allowedYears.includes(current.level) ? current.level : "",
        };
      }

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
      if (!form.level) {
        nextErrors.level = "Select your level.";
      } else if (!yearOptionsForProgram(form.program).includes(form.level)) {
        nextErrors.level = "Select an available level for your program.";
      }
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
        class_id:
          form.requestType === "absence" ? matchedClass?.class_id : form.classId,
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
        <RequestPageCanvas>
          <div className="mx-auto w-full max-w-[760px]">
            <Card className="rounded-2xl border border-slate-200 bg-white py-0 shadow-sm">
              <CardContent className="grid gap-5 px-5 py-7 sm:px-10 sm:py-9">
                <div className="grid justify-items-center gap-4 py-3 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-[#2E9E6B]">
                    <CheckCircle2 className="size-7" />
                  </div>
                  <RequestTitle>
                    {requestTitle(form.requestType)} -{" "}
                    <span className="font-medium">
                      Higher Education Department
                    </span>
                  </RequestTitle>
                  <p className="text-sm font-semibold text-slate-600">
                    Your response has been recorded.
                  </p>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-sm font-bold text-[#101C4A] underline-offset-4 hover:underline"
                  >
                    Submit another response
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </RequestPageCanvas>
      </StudentPageLayout>
    );
  }

  return (
    <StudentPageLayout>
      <RequestPageCanvas>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          {step === 0 && (
            <RequestShell requestType={form.requestType} step={step}>
              <div className="grid gap-2">
                <Eyebrow step={step} requestType={form.requestType} />
                <RequestTitle>
                  Request Form -{" "}
                  <span className="font-medium">
                    Higher Education Department
                  </span>
                </RequestTitle>
                <p className="max-w-[520px] text-sm leading-relaxed text-slate-500">
                  Choose the request you want to submit. The next steps will
                  adjust based on your selected form.
                </p>
              </div>

              <div className="mt-2 grid gap-3">
                <FieldLabel>Request</FieldLabel>
                <select
                  id="request-type"
                  value={form.requestType}
                  onChange={(event) =>
                    updateField("requestType", event.target.value)
                  }
                  aria-invalid={Boolean(fieldErrors.requestType)}
                  className={controlClass(
                    fieldErrors.requestType,
                    "h-11 rounded-[9px] px-3 text-sm text-slate-700 outline-none",
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
            <RequestShell requestType={form.requestType} step={step}>
              <HeaderIdentity
                requestType={form.requestType}
                step={step}
                user={user}
              />
              <p className="text-sm leading-relaxed text-slate-700">
                This form is used by students of the Higher Education Department
                to formally notify and request approval for{" "}
                {form.requestType === "absence" ? "an absence" : "tardiness"}{" "}
                from classes and other academic activities. It serves as an
                official record and provides the necessary information,
                explanation, and supporting documents for evaluation and
                approval.
              </p>
              <p className="text-sm leading-relaxed text-slate-700">
                Students are required to complete this form accurately and
                submit relevant proof or documentation. Submission of this form
                does not automatically grant approval. All requests are subject
                to review and validation in accordance with the Higher Education
                Department process.
              </p>
              <FormNavigation onBack={previousStep} onNext={nextStep} />
            </RequestShell>
          )}

          {step === 2 && (
            <RequestShell requestType={form.requestType} step={step}>
              <HeaderIdentity
                requestType={form.requestType}
                step={step}
                user={user}
              />
              <SectionBox title="Data Privacy Notice">
                <p className="text-sm leading-relaxed text-slate-700">
                  In compliance with data privacy laws, including Republic Act
                  No. 10173 Philippine Data Privacy Act of 2012, the Higher
                  Education Department collects, uses, stores, and processes
                  your personal information in this form for documentation and
                  attendance tracking purposes only.
                </p>
                <p className="text-sm leading-relaxed text-slate-700">
                  For your data privacy inquiries, you may reach our Data
                  Protection Officer through:
                </p>
                <p className="text-sm font-semibold text-slate-700">
                  Email: dpo@laverdad.edu.ph
                </p>
              </SectionBox>

              <SectionBox
                invalid={Boolean(fieldErrors.consent)}
                title="Compliance and Consent"
              >
                <p className="text-sm leading-relaxed text-slate-700">
                  By ticking "I Agree", I voluntarily give my consent to LVCC in
                  collecting, processing, recording, using, and retaining my
                  personal information for the above-mentioned purpose in
                  accordance with this Privacy Notice.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <OptionLabel>
                    <input
                      type="radio"
                      name="consent"
                      value="agree"
                      checked={form.consent === "agree"}
                      onClick={(event) =>
                        handleRadioClick("consent", "agree", event)
                      }
                      onChange={(event) =>
                        updateField("consent", event.target.value)
                      }
                      className="accent-[#101C4A]"
                    />
                    I Agree
                  </OptionLabel>
                  <OptionLabel>
                    <input
                      type="radio"
                      name="consent"
                      value="disagree"
                      checked={form.consent === "disagree"}
                      onClick={(event) =>
                        handleRadioClick("consent", "disagree", event)
                      }
                      onChange={(event) =>
                        updateField("consent", event.target.value)
                      }
                      className="accent-[#101C4A]"
                    />
                    I Disagree
                  </OptionLabel>
                </div>
                <ErrorText message={fieldErrors.consent} />
              </SectionBox>
              <FormNavigation onBack={previousStep} onNext={nextStep} />
            </RequestShell>
          )}

          {step === 3 && (
            <RequestShell requestType={form.requestType} step={step}>
              <HeaderIdentity
                requestType={form.requestType}
                step={step}
                user={user}
              />
              <SectionBox
                invalid={Boolean(fieldErrors.studentName)}
                title="Student Information"
              >
                <div className="grid gap-2">
                  <FieldLabel>Student Name</FieldLabel>
                  <Input
                    value={form.studentName}
                    onChange={(event) =>
                      updateField("studentName", event.target.value)
                    }
                    placeholder="Add text here..."
                    aria-invalid={Boolean(fieldErrors.studentName)}
                    className={controlClass(
                      fieldErrors.studentName,
                      "h-11 rounded-[9px] text-sm shadow-none",
                    )}
                  />
                  <ErrorText message={fieldErrors.studentName} />
                </div>
              </SectionBox>

              <SectionBox invalid={Boolean(fieldErrors.program)} title="Program">
                <div className="grid gap-2 sm:grid-cols-2">
                  {programOptions.map((program) => (
                    <OptionLabel key={program}>
                      <input
                        type="radio"
                        name="program"
                        value={program}
                        checked={form.program === program}
                        onClick={(event) =>
                          handleRadioClick("program", program, event)
                        }
                        onChange={(event) =>
                          updateField("program", event.target.value)
                        }
                        className="accent-[#101C4A]"
                      />
                      {program}
                    </OptionLabel>
                  ))}
                </div>
                <ErrorText message={fieldErrors.program} />
              </SectionBox>

              <SectionBox invalid={Boolean(fieldErrors.level)} title="Level">
                <div className="grid gap-2 sm:grid-cols-4">
                  {yearOptionsForProgram(form.program).map((year) => (
                    <OptionLabel key={year}>
                      <input
                        type="radio"
                        name="level"
                        value={year}
                        checked={form.level === year}
                        onClick={(event) =>
                          handleRadioClick("level", year, event)
                        }
                        onChange={(event) =>
                          updateField("level", event.target.value)
                        }
                        className="accent-[#101C4A]"
                      />
                      {year}
                    </OptionLabel>
                  ))}
                </div>
                <ErrorText message={fieldErrors.level} />
              </SectionBox>

              <SectionBox invalid={Boolean(fieldErrors.guardianName)}>
                <div className="grid gap-2">
                  <FieldLabel>Parent/Guardian's Name</FieldLabel>
                  <Input
                    value={form.guardianName}
                    onChange={(event) =>
                      updateField("guardianName", event.target.value)
                    }
                    placeholder="Add text here..."
                    aria-invalid={Boolean(fieldErrors.guardianName)}
                    className={controlClass(
                      fieldErrors.guardianName,
                      "h-11 rounded-[9px] text-sm shadow-none",
                    )}
                  />
                  <ErrorText message={fieldErrors.guardianName} />
                </div>
              </SectionBox>

              <SectionBox invalid={Boolean(fieldErrors.contactNumber)}>
                <div className="grid gap-2">
                  <FieldLabel>Contact Number</FieldLabel>
                  <Input
                    value={form.contactNumber}
                    onChange={(event) =>
                      updateField(
                        "contactNumber",
                        normalizePhoneInput(event.target.value),
                      )
                    }
                    placeholder="09XXXXXXXXX or +639XXXXXXXXX"
                    aria-invalid={Boolean(fieldErrors.contactNumber)}
                    className={controlClass(
                      fieldErrors.contactNumber,
                      "h-11 rounded-[9px] text-sm shadow-none",
                    )}
                  />
                  <ErrorText message={fieldErrors.contactNumber} />
                </div>
              </SectionBox>

              <SectionBox invalid={Boolean(fieldErrors.dateSubmitted)}>
                <div className="grid gap-2">
                  <FieldLabel>Date Submitted</FieldLabel>
                  <Input
                    type="date"
                    value={form.dateSubmitted}
                    onChange={(event) =>
                      updateField("dateSubmitted", event.target.value)
                    }
                    aria-invalid={Boolean(fieldErrors.dateSubmitted)}
                    className={controlClass(
                      fieldErrors.dateSubmitted,
                      "h-11 rounded-[9px] text-sm shadow-none",
                    )}
                  />
                  <ErrorText message={fieldErrors.dateSubmitted} />
                </div>
              </SectionBox>
              <FormNavigation onBack={previousStep} onNext={nextStep} />
            </RequestShell>
          )}

          {step === 4 && (
            <RequestShell requestType={form.requestType} step={step}>
              <HeaderIdentity
                requestType={form.requestType}
                step={step}
                user={user}
              />
              {form.requestType === "absence" ? (
                <>
                  <SectionBox
                    invalid={Boolean(fieldErrors.startDateOfAbsence)}
                    title="Absence Details"
                  >
                    <div className="grid gap-2">
                      <FieldLabel>Start Date of Absence</FieldLabel>
                      <Input
                        type="date"
                        value={form.startDateOfAbsence}
                        onChange={(event) =>
                          updateField("startDateOfAbsence", event.target.value)
                        }
                        aria-invalid={Boolean(fieldErrors.startDateOfAbsence)}
                        className={controlClass(
                          fieldErrors.startDateOfAbsence,
                          "h-11 rounded-[9px] text-sm shadow-none",
                        )}
                      />
                      <ErrorText message={fieldErrors.startDateOfAbsence} />
                    </div>
                  </SectionBox>

                  <SectionBox invalid={Boolean(fieldErrors.endDateOfAbsence)}>
                    <div className="grid gap-2">
                      <FieldLabel>End Date of Absence</FieldLabel>
                      <Input
                        type="date"
                        value={form.endDateOfAbsence}
                        onChange={(event) =>
                          updateField("endDateOfAbsence", event.target.value)
                        }
                        aria-invalid={Boolean(fieldErrors.endDateOfAbsence)}
                        className={controlClass(
                          fieldErrors.endDateOfAbsence,
                          "h-11 rounded-[9px] text-sm shadow-none",
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
                    <FieldLabel>How many minutes late?</FieldLabel>
                    <Input
                      inputMode="numeric"
                      value={form.minutesLate}
                      onChange={(event) =>
                        updateField("minutesLate", event.target.value)
                      }
                      aria-invalid={Boolean(fieldErrors.minutesLate)}
                      className={controlClass(
                        fieldErrors.minutesLate,
                        "h-11 rounded-[9px] text-sm shadow-none",
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
                title={
                  form.requestType === "absence"
                    ? "Program"
                    : "Program Subject/Class(es)"
                }
              >
                {form.requestType === "absence" ? (
                  <>
                    <div className="grid gap-1 text-xs leading-relaxed text-slate-700">
                      <p className="font-semibold">Subject(s)/Class(es)*</p>
                      <p>
                        Please list them in bullet form including the name of
                        the instructor.
                      </p>
                    </div>
                    <div className="grid gap-1 text-xs leading-relaxed text-slate-700">
                      <p className="font-semibold">Example:</p>
                      <ul className="ml-4 list-disc">
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
                        "h-11 rounded-[9px] text-sm shadow-none",
                      )}
                    />
                  </>
                ) : (
                  <select
                    value={form.classId}
                    onChange={(event) =>
                      updateField("classId", event.target.value)
                    }
                    disabled={classesLoading}
                    aria-invalid={Boolean(fieldErrors.classId)}
                    className={controlClass(
                      fieldErrors.classId,
                      "h-11 rounded-[9px] px-3 text-sm text-slate-700 outline-none",
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
                  <p className="text-xs font-semibold text-red-600">
                    {classesError}
                  </p>
                )}
                <ErrorText
                  message={
                    form.requestType === "absence"
                      ? fieldErrors.classText
                      : fieldErrors.classId
                  }
                />
              </SectionBox>

              {form.requestType === "absence" ? (
                <SectionBox invalid={Boolean(fieldErrors.absenceReasons)}>
                  <div className="grid gap-2">
                    <FieldLabel>Reason of Absence</FieldLabel>
                    {absenceReasonOptions.map((reason) => (
                      <label
                        key={reason}
                        className="flex items-center gap-2 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={form.absenceReasons.includes(reason)}
                          onChange={() =>
                            toggleListField("absenceReasons", reason)
                          }
                          className="accent-[#101C4A]"
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
                    <FieldLabel>Reason</FieldLabel>
                    <Input
                      value={form.reason}
                      onChange={(event) =>
                        updateField("reason", event.target.value)
                      }
                      aria-invalid={Boolean(fieldErrors.reason)}
                      className={controlClass(
                        fieldErrors.reason,
                        "h-11 rounded-[9px] text-sm shadow-none",
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
            <RequestShell requestType={form.requestType} step={step}>
              <HeaderIdentity
                requestType={form.requestType}
                step={step}
                user={user}
              />
              {form.requestType === "absence" && (
                <SectionBox title="Explanation">
                  <div className="grid gap-2">
                    <FieldLabel>Supporting Documents / Proof of Absence</FieldLabel>
                    {proofOptions.map((proof) => (
                      <label
                        key={proof}
                        className="flex items-center gap-2 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={form.proofTypes.includes(proof)}
                          onChange={() => toggleListField("proofTypes", proof)}
                          className="accent-[#101C4A]"
                        />
                        {proof}
                      </label>
                    ))}
                  </div>
                </SectionBox>
              )}

              <SectionBox
                title={form.requestType === "late" ? "Explanation" : undefined}
              >
                <FieldLabel>
                  Please attach any applicable supporting document(s):
                </FieldLabel>
                <p className="text-xs text-slate-500">
                  Upload 1 supported file. Max 10MB.
                </p>
                <label className="flex min-h-[88px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-slate-200 bg-[#FBFBFD] px-4 py-6 text-center text-sm text-slate-500 transition-colors hover:border-[#101C4A]/40 hover:bg-white">
                  <span className="inline-flex items-center gap-2 font-bold text-[#101C4A]">
                    <Upload className="size-4" />
                    Click to upload
                  </span>
                  <span>PDF, JPG, or PNG - max 10MB</span>
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(event) =>
                      updateField(
                        "evidenceFile",
                        event.target.files?.[0] || null,
                      )
                    }
                  />
                </label>
                {form.evidenceFile && (
                  <p className="text-sm font-semibold text-slate-700">
                    {form.evidenceFile.name}
                  </p>
                )}
              </SectionBox>
              <FormNavigation onBack={previousStep} onNext={nextStep} />
            </RequestShell>
          )}

          {step === 6 && (
            <RequestShell requestType={form.requestType} step={step}>
              <HeaderIdentity
                requestType={form.requestType}
                step={step}
                user={user}
              />
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
                <p className="rounded-[10px] border border-slate-200 bg-white p-4 text-sm font-semibold leading-relaxed text-slate-700">
                  I hereby certify that the information provided above is true
                  and correct. I understand that submission of this form does
                  not automatically excuse my{" "}
                  {form.requestType === "absence" ? "absence" : "tardiness"}{" "}
                  and remains subject to verification and approval by the
                  appropriate authority.
                </p>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.declaration}
                    onChange={(event) =>
                      updateField("declaration", event.target.checked)
                    }
                    className="mt-1 accent-[#101C4A]"
                  />
                  I acknowledge and agree to the statement above.
                </label>
                <ErrorText message={fieldErrors.declaration} />
              </SectionBox>
              <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={previousStep}
                  className="h-11 rounded-[9px] border-[1.5px] border-slate-200 px-5 text-sm font-bold text-slate-500 hover:text-slate-950"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-11 rounded-[9px] bg-[#101C4A] px-6 text-sm font-bold text-white hover:bg-[#1B2B6B]"
                >
                  {submitting && <Spinner className="mr-2" />}
                  Submit
                </Button>
              </div>
            </RequestShell>
          )}
        </form>
      </RequestPageCanvas>
    </StudentPageLayout>
  );
}

export default StudentRequestForm;
