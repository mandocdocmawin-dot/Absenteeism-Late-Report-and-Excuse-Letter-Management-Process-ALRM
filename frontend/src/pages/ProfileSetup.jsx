import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, UserRound } from "lucide-react";
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
import { useAuth } from "@/context/AuthContext";
import {
  getStoredProfileSetup,
  isProfileSetupComplete,
  splitVerifiedName,
  storeProfileSetup,
} from "@/lib/profileSetup";
import { normalizeRole } from "@/lib/roles";
import lvLogo from "@/assets/LV_Logo.png";

const roleOptions = [
  { label: "Student", value: "student" },
  { label: "Instructor", value: "instructor" },
  { label: "Program", value: "program_head" },
];

const defaultPrograms = [
  {
    id: "bs-information-systems",
    program_name: "BS in Information Systems",
  },
  {
    id: "bs-accountancy",
    program_name: "BS in Accountancy",
  },
  {
    id: "bs-accountancy-information-systems",
    program_name: "BS in Accountancy Information Systems",
  },
  {
    id: "bs-social-work",
    program_name: "BS in Social Work",
  },
  {
    id: "ba-broadcasting",
    program_name: "BA in Broadcasting",
  },
  {
    id: "associate-computer-technology",
    program_name: "Associate in Computer Technology",
  },
];

const fullYearOptions = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const associateYearOptions = ["1st Year", "2nd Year"];

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

function normalizedProgramName(program) {
  return programLabel(program).trim().toLowerCase();
}

function mergePrograms(apiPrograms) {
  const programs = [...apiPrograms];
  const seen = new Set(apiPrograms.map((program) => normalizedProgramName(program)));

  defaultPrograms.forEach((program) => {
    if (!seen.has(normalizedProgramName(program))) {
      programs.push(program);
    }
  });

  return programs.sort((first, second) =>
    programLabel(first).localeCompare(programLabel(second)),
  );
}

function isAssociateComputerTechnology(program) {
  const label = normalizedProgramName(program);

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

function ProfileSetup() {
  const navigate = useNavigate();
  const { refreshUser, user } = useAuth();
  const storedSetup = useMemo(() => getStoredProfileSetup(user), [user]);
  const parsedName = useMemo(() => splitVerifiedName(user?.name), [user?.name]);
  const [programs, setPrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [programsError, setProgramsError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    role: normalizeRole(user?.role) === "program" ? "program_head" : user?.role || storedSetup?.role || "",
    programId: user?.program_id || storedSetup?.program_id || "",
    studentNumber: storedSetup?.student_number || user?.student_number || "",
    yearLevel: user?.year_level || storedSetup?.year_level || "",
  });
  const [errors, setErrors] = useState({});
  const selectedProgram = useMemo(
    () =>
      programs.find(
        (program) => String(programId(program)) === String(form.programId),
      ),
    [form.programId, programs],
  );
  const availableYearOptions = useMemo(
    () =>
      isAssociateComputerTechnology(selectedProgram)
        ? associateYearOptions
        : fullYearOptions,
    [selectedProgram],
  );

  useEffect(() => {
    setForm({
      role:
        normalizeRole(user?.role) === "program"
          ? "program_head"
          : user?.role || storedSetup?.role || "",
      programId: user?.program_id || storedSetup?.program_id || "",
      studentNumber: storedSetup?.student_number || user?.student_number || "",
      yearLevel: user?.year_level || storedSetup?.year_level || "",
    });
  }, [storedSetup, user]);

  useEffect(() => {
    if (user && isProfileSetupComplete(user)) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, user]);

  useEffect(() => {
    let alive = true;

    async function loadPrograms() {
      setProgramsLoading(true);
      setProgramsError("");

      try {
        const data = await getProfileSetupPrograms();
        if (alive) setPrograms(mergePrograms(data));
      } catch (loadError) {
        if (alive) {
          setPrograms(defaultPrograms);
          setProgramsError(
            loadError?.message || "Unable to load program options.",
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
  }, []);

  function updateField(name, value) {
    setForm((current) => {
      if (name !== "programId") return { ...current, [name]: value };

      const nextProgram = programs.find(
        (program) => String(programId(program)) === String(value),
      );
      const nextYearOptions = isAssociateComputerTechnology(nextProgram)
        ? associateYearOptions
        : fullYearOptions;

      return {
        ...current,
        programId: value,
        yearLevel: nextYearOptions.includes(current.yearLevel)
          ? current.yearLevel
          : "",
      };
    });
    setErrors((current) => ({ ...current, [name]: "" }));
    setError("");
  }

  function validate() {
    const nextErrors = {};
    const selectedRole = normalizeRole(form.role);

    if (!form.role) nextErrors.role = "Select your role.";
    if (!form.programId) nextErrors.programId = "Select your program.";
    if (selectedRole === "student" && !form.studentNumber.trim()) {
      nextErrors.studentNumber = "Enter your student ID.";
    }
    if (selectedRole === "student" && !form.yearLevel) {
      nextErrors.yearLevel = "Select your year.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!validate()) return;

    const payload = {
      role: form.role,
      program_id: form.programId,
      student_id: form.studentNumber.trim(),
      student_number: form.studentNumber.trim(),
      year_level: form.yearLevel,
    };

    setSubmitting(true);
    setNotice("");
    setError("");

    try {
      const result = await saveProfileSetup(payload);

      storeProfileSetup(user, {
        ...payload,
        program_name: selectedProgram ? programLabel(selectedProgram) : "",
      });

      if (result.savedToBackend) {
        await refreshUser();
      } else {
        setNotice(result.message);
      }

      navigate("/dashboard", { replace: true });
    } catch (saveError) {
      setError(
        saveError?.message ||
          "Unable to save your profile setup. Please try again.",
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
          {notice && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-950">
              <AlertCircle className="size-4" />
              <AlertTitle>Frontend setup saved</AlertTitle>
              <AlertDescription className="text-amber-900">
                {notice}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Profile setup failed</AlertTitle>
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
              <div className="grid gap-2">
                <Label htmlFor="setup-role">Role</Label>
                <select
                  id="setup-role"
                  value={form.role}
                  onChange={(event) => updateField("role", event.target.value)}
                  className="h-10 rounded-[5px] border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 shadow-none outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Select role</option>
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.role} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="setup-program">Program</Label>
                <select
                  id="setup-program"
                  value={form.programId}
                  onChange={(event) =>
                    updateField("programId", event.target.value)
                  }
                  disabled={programsLoading}
                  className="h-10 rounded-[5px] border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 shadow-none outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-slate-100"
                >
                  <option value="">
                    {programsLoading ? "Loading programs..." : "Select program"}
                  </option>
                  {programs.map((program) => (
                    <option key={programId(program)} value={programId(program)}>
                      {programLabel(program)}
                    </option>
                  ))}
                </select>
                {programsError && !errors.programId && (
                  <p className="text-xs text-amber-700">
                    Using default program options because the backend list is unavailable.
                  </p>
                )}
                <FieldError message={errors.programId} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="setup-student-number">Student ID</Label>
                <Input
                  id="setup-student-number"
                  value={form.studentNumber}
                  onChange={(event) =>
                    updateField("studentNumber", event.target.value)
                  }
                  placeholder="Enter your school student ID"
                  className="h-10 rounded-[5px] border-slate-300 text-sm shadow-none"
                />
                <p className="text-xs text-slate-500">
                  Required for student accounts.
                </p>
                <FieldError message={errors.studentNumber} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="setup-year">Year</Label>
                <select
                  id="setup-year"
                  value={form.yearLevel}
                  onChange={(event) =>
                    updateField("yearLevel", event.target.value)
                  }
                  className="h-10 rounded-[5px] border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 shadow-none outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Select year</option>
                  {availableYearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">
                  Required for student accounts.
                </p>
                <FieldError message={errors.yearLevel} />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="submit"
                disabled={submitting}
                className="h-10 rounded-[5px] bg-[#0b4bd3] px-5 font-bold text-white hover:bg-[#083da9]"
              >
                {submitting && <Spinner className="mr-2" />}
                {submitting ? "Saving..." : "Continue to Dashboard"}
              </Button>
            </div>
          </form>

          <p className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="size-3.5 text-green-600" />
            This setup only appears before dashboard access when required
            profile details are missing.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export default ProfileSetup;
