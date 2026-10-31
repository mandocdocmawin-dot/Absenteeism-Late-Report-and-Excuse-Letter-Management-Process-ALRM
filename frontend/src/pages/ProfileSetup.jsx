import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, RefreshCw, UserRound } from "lucide-react";
import { getProfileSetupPrograms, saveProfileSetup } from "@/api/profileSetup";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import LoadingSkeleton from "@/components/loading/LoadingSkeleton";
import { useAuth } from "@/context/AuthContext";
import {
  ASSOCIATE_YEAR_LEVELS,
  YEAR_LEVELS,
  clearLegacyProfileSetup,
  isProfileSetupComplete,
  splitVerifiedName,
} from "@/lib/profileSetup";
import { normalizeRole } from "@/lib/roles";
import { prepareProfileInput } from "@/lib/formInputs";
import { getSelectablePrograms } from "@/lib/programs";
import lvLogo from "@/assets/lv-logo-auth.webp";

const ROLE_LABELS = {
  student: "Student",
  instructor: "Instructor",
  program_head: "Program Head",
  administrator: "Administrator",
};

// Backend field name -> form field name
const FIELD_MAP = {
  program_id: "programId",
  school_id_number: "schoolIdNumber",
  year_level: "yearLevel",
};

function valueFrom(item, keys, fallback = "") {
  for (const key of keys) {
    const value = key.split(".").reduce((current, part) => current?.[part], item);
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return fallback;
}

function programId(program) {
  return valueFrom(program, ["id", "program_id", "programId"], "");
}

function programLabel(program) {
  return valueFrom(program, ["program_name", "programName", "name"], "Unnamed Program");
}

function isAssociateComputerTechnology(program) {
  if (!program) return false;
  const label = programLabel(program).trim().toLowerCase();

  return (
    label === "associate in computer technology" ||
    label === "associate in computer technology (act)" ||
    label === "act"
  );
}

function ReadOnlyIdentityField({ label, value }) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs font-bold text-slate-700">{label}</Label>
      <Input
        readOnly
        value={value || "Not available"}
        className="h-10 rounded-[5px] border-slate-300 bg-slate-50 text-sm font-medium text-slate-700 shadow-none"
      />
    </div>
  );
}

function FieldError({ message }) {
  if (!message) return null;

  return <p className="text-xs font-semibold text-red-600">{message}</p>;
}

const selectClass =
  "h-10 w-full min-w-0 rounded-[5px] border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 shadow-none outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-slate-100";

function ProfileSetup() {
  const navigate = useNavigate();
  const { refreshUser, user } = useAuth();

  // Ang role ay galing sa server at read-only. Hindi ito ipinapadala.
  const serverRole = normalizeRole(user?.role);
  const isStudent = serverRole === "student";
  const isInstructor = serverRole === "instructor";
  const roleLabel = ROLE_LABELS[user?.role] || user?.role || "";
  const needsProgram = !user?.program_id;
  const needsSchoolId = (isStudent || isInstructor) && !user?.school_id_number;
  const needsYearLevel = isStudent && !user?.year_level;

  const parsedName = useMemo(() => splitVerifiedName(user?.name), [user?.name]);
  const [programs, setPrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [programsError, setProgramsError] = useState("");
  const [programsRequestKey, setProgramsRequestKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    programId: user?.program_id || "",
    schoolIdNumber: user?.school_id_number || "",
    yearLevel: user?.year_level || "",
  });
  const [errors, setErrors] = useState({});

  const selectedProgram = useMemo(
    () =>
      programs.find(
        (program) => String(programId(program)) === String(form.programId),
      ) || (!needsProgram ? user?.program : null),
    [form.programId, needsProgram, programs, user?.program],
  );
  const availableYearOptions = isAssociateComputerTechnology(selectedProgram)
    ? ASSOCIATE_YEAR_LEVELS
    : YEAR_LEVELS;
  const validProgram = Boolean(form.programId) && (!needsProgram || Boolean(selectedProgram));
  const validSchoolId = !(isStudent || isInstructor) || Boolean(form.schoolIdNumber.trim());
  const validYear = !isStudent || availableYearOptions.some((year) => year.value === form.yearLevel);
  const formReady = Boolean(serverRole) && validProgram && validSchoolId && validYear;

  // Isang beses: linisin ang lumang localStorage setup.
  useEffect(() => {
    clearLegacyProfileSetup();
  }, []);

  useEffect(() => {
    if (user && isProfileSetupComplete(user)) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, user]);

  useEffect(() => {
    let alive = true;

    async function loadPrograms() {
      if (!needsProgram) {
        setProgramsLoading(false);
        return;
      }
      setProgramsLoading(true);
      setProgramsError("");

      try {
        const data = await getProfileSetupPrograms();
        if (alive) setPrograms(data);
      } catch (loadError) {
        if (alive) {
          setPrograms([]);
          setProgramsError(
            loadError?.message || "Unable to load programs. Please try again.",
          );
        }
      } finally {
        if (alive) setProgramsLoading(false);
      }
    }

    loadPrograms();

    return () => {
      alive = false;
    };
  }, [needsProgram, programsRequestKey]);

  function updateField(name, value) {
    setForm((current) => {
      if (name !== "programId") return { ...current, [name]: value };

      const nextProgram = programs.find(
        (program) => String(programId(program)) === String(value),
      );
      const nextOptions = isAssociateComputerTechnology(nextProgram)
        ? ASSOCIATE_YEAR_LEVELS
        : YEAR_LEVELS;

      return {
        ...current,
        programId: value,
        yearLevel: nextOptions.some((year) => year.value === current.yearLevel)
          ? current.yearLevel
          : "",
      };
    });
    setErrors((current) => ({ ...current, [name]: "" }));
    setError("");
  }

  function validate(payload) {
    const nextErrors = {};
    try { prepareProfileInput(payload); }
    catch (issue) {
      for (const [key, messages] of Object.entries(issue.fieldErrors || {})) nextErrors[FIELD_MAP[key] || key] = messages[0];
    }

    if (!serverRole) nextErrors.role = "Your account has no role. Contact an administrator.";
    if (needsProgram && !selectedProgram) nextErrors.programId = "Select a program from the available list.";
    if (needsSchoolId && !form.schoolIdNumber.trim()) {
      nextErrors.schoolIdNumber = `Enter your ${isInstructor ? "instructor" : "student"} ID.`;
    }
    if (needsYearLevel && !availableYearOptions.some(year => year.value === form.yearLevel)) {
      nextErrors.yearLevel = "Select an available year.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    // The server determines the role; the form only submits profile fields.
    const payload = {};
    if (needsProgram) payload.program_id = form.programId;
    if (needsSchoolId) {
      payload.school_id_number = form.schoolIdNumber.trim();
    }
    if (needsYearLevel) {
      payload.year_level = form.yearLevel; // "1st" | "2nd" | "3rd" | "4th"
    }

    if (submitting || !validate(payload)) return;

    setSubmitting(true);
    setError("");

    try {
      await saveProfileSetup(payload);
      await refreshUser(); // kunin ang bagong user mula sa server
      navigate("/dashboard", { replace: true });
    } catch (saveError) {
      // 422: ilagay ang mensahe sa mismong field
      if (saveError?.status === 422 && saveError.fieldErrors) {
        const fieldErrors = {};
        for (const [field, messages] of Object.entries(saveError.fieldErrors)) {
          fieldErrors[FIELD_MAP[field] || "form"] = messages?.[0];
        }
        setErrors((current) => ({ ...current, ...fieldErrors }));
      }

      // 409 (kumpleto na), 422, network, atbp.: laging may nakikitang mensahe
      setError(
        saveError?.message ||
          "Unable to save your profile. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10 text-slate-950">
      <Card className="w-full max-w-3xl rounded-[8px] border-slate-200 bg-white shadow-sm">
        <CardHeader className="items-center gap-3 text-center">
          <img
            src={lvLogo}
            width="384"
            height="384"
            alt="ALRM System logo"
            className="size-16 object-contain"
          />
          <div>
            <CardTitle className="text-2xl font-black tracking-normal">
              Complete Your Profile
            </CardTitle>
            <CardDescription className="mt-2 text-sm text-slate-600">
              Confirm your verified LV account information before entering the
              dashboard.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="grid gap-5">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Profile not saved</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <section className="rounded-[6px] border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4 flex items-center gap-2 text-[#203b82]">
              <UserRound className="size-5" />
              <h2 className="text-sm font-black uppercase">
                Verified Information
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyIdentityField label="Email" value={user?.email} />
              <ReadOnlyIdentityField
                label="First Name"
                value={user?.first_name || user?.firstName || parsedName.firstName}
              />
              <ReadOnlyIdentityField
                label="Middle Name"
                value={user?.middle_name || user?.middleName || parsedName.middleName}
              />
              <ReadOnlyIdentityField
                label="Last Name"
                value={user?.last_name || user?.lastName || parsedName.lastName}
              />
            </div>
          </section>

          <form className="grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              {needsProgram && <div className="grid min-w-0 gap-2">
                <Label htmlFor="setup-program">Program</Label>
                {programsLoading ? <LoadingSkeleton variant="field" label="Loading programs..." /> : <select
                  id="setup-program"
                  value={form.programId}
                  onChange={(event) =>
                    updateField("programId", event.target.value)
                  }
                  disabled={programsLoading || Boolean(programsError) || submitting}
                  aria-invalid={Boolean(errors.programId)}
                  className={selectClass}
                >
                  <option value="">
                    {programsLoading
                      ? "Loading programs..."
                      : programsError
                        ? "Programs unavailable"
                        : "Select program"}
                  </option>
                  {getSelectablePrograms(programs).map((program) => (
                    <option key={programId(program)} value={programId(program)}>
                      {programLabel(program)}
                    </option>
                  ))}
                </select>}
                {programsError && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-red-600">
                    <span>{programsError}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setProgramsRequestKey((current) => current + 1)
                      }
                      className="h-7 rounded-[5px] px-2 font-bold text-[#0b4bd3]"
                    >
                      <RefreshCw className="size-3.5" />
                      Retry
                    </Button>
                  </div>
                )}
                <FieldError message={errors.programId} />
              </div>}

              {needsSchoolId && (
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="setup-school-id-number">
                    {isInstructor ? "Instructor ID" : "Student ID"}
                  </Label>
                  <Input
                    id="setup-school-id-number"
                    value={form.schoolIdNumber}
                    onChange={(event) =>
                      updateField("schoolIdNumber", event.target.value)
                    }
                    disabled={submitting}
                    aria-invalid={Boolean(errors.schoolIdNumber)}
                    placeholder={`Enter your ${isInstructor ? "instructor" : "student"} ID`}
                    className="h-10 rounded-[5px] border-slate-300 text-sm shadow-none"
                  />
                  <p className="text-xs text-slate-500">
                    Required for {isInstructor ? "instructor" : "student"} accounts.
                  </p>
                  <FieldError message={errors.schoolIdNumber} />
                </div>
              )}

              {needsYearLevel && (
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="setup-year">Year</Label>
                    <select
                      id="setup-year"
                      value={form.yearLevel}
                      onChange={(event) =>
                        updateField("yearLevel", event.target.value)
                      }
                      disabled={submitting}
                      aria-invalid={Boolean(errors.yearLevel)}
                      className={selectClass}
                    >
                      <option value="">Select year</option>
                      {availableYearOptions.map((year) => (
                        <option key={year.value} value={year.value}>
                          {year.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">
                      Required for student accounts.
                    </p>
                    <FieldError message={errors.yearLevel} />
                  </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="submit"
                disabled={!formReady || submitting || (needsProgram && (programsLoading || Boolean(programsError)))}
                className="h-10 rounded-[5px] bg-[#0b4bd3] px-5 font-bold text-white hover:bg-[#083da9]"
              >
                {submitting && <Spinner className="mr-2" />}
                {submitting ? "Saving..." : "Continue to Dashboard"}
              </Button>
            </div>
          </form>

          <p className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="size-3.5 text-green-600" />
            Only missing fields are requested. Your assigned {roleLabel || "account"} details cannot be changed here.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export default ProfileSetup;
