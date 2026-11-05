import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, IdCard, Mail, User } from "lucide-react";
import { createAdminUser, getAdminPrograms } from "@/api/adminUsers";
import LoadingSkeleton from "@/components/loading/LoadingSkeleton";
import PageBreadcrumbs from "@/components/navigation/PageBreadcrumbs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { emailPattern, sanitizeText } from "@/lib/inputValidation";
import { getSelectablePrograms } from "@/lib/programs";
import AdminPageLayout from "./AdminPageLayout";

const roleOptions = [
  { value: "student", label: "Student" },
  { value: "instructor", label: "Instructor" },
  { value: "program_head", label: "Program Head" },
  { value: "administrator", label: "Administrator" },
];

function initialForm(role = "student") {
  return { first_name: "", middle_name: "", last_name: "", email: "", role, program_id: "", school_id_number: "" };
}

function formErrorFrom(error) {
  if (error?.status === 401) return "Your session has expired. Sign in again to add a user.";
  if (error?.status === 403) return "Your account is not allowed to add users.";
  if (error?.status === 409) return error.message || "This account conflicts with an existing record.";
  return error?.message || "Something went wrong while saving this account.";
}

function firstError(messages) {
  return Array.isArray(messages) ? messages[0] : messages;
}

function TextField({ error, icon: Icon, label, name, onChange, optional = false, placeholder, type = "text", value }) {
  return <Field data-invalid={Boolean(error)}>
    <FieldLabel htmlFor={name}>{label}{optional ? " (optional)" : ""}</FieldLabel>
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" strokeWidth={1.7} />}
      <Input id={name} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} aria-invalid={Boolean(error)} className={cn("h-11 rounded-[5px] border-slate-300 text-sm shadow-none", Icon && "pl-9")} />
    </div>
    <FieldError>{error}</FieldError>
  </Field>;
}

function SelectField({ children, disabled = false, error, label, loading = false, name, onChange, value }) {
  return <Field data-invalid={Boolean(error)}>
    <FieldLabel htmlFor={name}>{label}</FieldLabel>
    {loading ? <LoadingSkeleton variant="field" label={`Loading ${label}`} className="h-11" /> : <select id={name} name={name} value={value} onChange={onChange} disabled={disabled} aria-invalid={Boolean(error)} className="h-11 w-full appearance-none rounded-[5px] border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-slate-100 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20">{children}</select>}
    <FieldError>{error}</FieldError>
  </Field>;
}

export default function AdminUserForm({
  cancelPath = "/user-management",
  embedded = false,
  initialRole = "student",
  lockRole = false,
  onCancel,
  onCreated,
  parentLabel = "User Management",
  sectionTitle = "Account Information",
  submitLabel = "Add User",
  subtitle = "Pre-register an institutional account for Google sign-in",
  title = "Add User",
}) {
  const navigate = useNavigate();
  const [values, setValues] = useState(() => initialForm(initialRole));
  const [errors, setErrors] = useState({});
  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [programError, setProgramError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [submitError, setSubmitError] = useState("");
  const needsProgram = values.role !== "administrator";

  useEffect(() => {
    let alive = true;
    getAdminPrograms()
      .then((data) => { if (alive) setPrograms(data); })
      .catch((error) => { if (alive) setProgramError(error?.message || "Unable to load programs from the backend."); })
      .finally(() => { if (alive) setLoadingPrograms(false); });
    return () => { alive = false; };
  }, []);

  const programOptions = useMemo(() => getSelectablePrograms(programs).map((program) => ({
    label: program.program_name || program.name || `Program ${program.id}`,
    value: String(program.id),
  })), [programs]);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value, ...(name === "role" && value === "administrator" ? { program_id: "" } : {}) }));
    setErrors((current) => ({ ...current, [name]: "", ...(name === "role" ? { program_id: "" } : {}) }));
    setSuccess("");
    setSubmitError("");
  }

  function validate() {
    const next = {};
    if (!sanitizeText(values.first_name)) next.first_name = "First name is required.";
    if (!sanitizeText(values.last_name)) next.last_name = "Last name is required.";
    const email = sanitizeText(values.email).toLowerCase();
    if (!email) next.email = "Email address is required.";
    else if (!emailPattern.test(email)) next.email = "Enter a valid email address.";
    if (!roleOptions.some((option) => option.value === values.role)) next.role = "Select an available role.";
    if (needsProgram && !values.program_id) next.program_id = "Select a program.";
    if (!sanitizeText(values.school_id_number)) next.school_id_number = "User ID is required.";
    return next;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    setSuccess("");
    setSubmitError("");
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      const result = await createAdminUser(values);
      setSuccess(result?.message || "User pre-registered. The account remains pending until its first institutional Google sign-in.");
      setValues(initialForm(initialRole));
      onCreated?.(result);
    } catch (error) {
      const fieldErrors = error.fieldErrors || error.errors || error.body?.errors;
      if (fieldErrors) setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([key, messages]) => [key, firstError(messages)])));
      setSubmitError(formErrorFrom(error));
    } finally {
      setSubmitting(false);
    }
  }

  const formContent = <>
    <div className="mb-6"><h1 id={embedded ? "add-user-dialog-title" : undefined} className="text-2xl font-black tracking-normal text-slate-950">{title}</h1><p className="mt-1 text-sm font-medium text-slate-600">{subtitle}</p></div>
    <div className="w-full rounded-[5px] border border-slate-300 bg-white px-5 py-7 shadow-none sm:px-8">
      <form onSubmit={handleSubmit} noValidate>
        <FieldSet>
          <FieldLegend className="text-base font-bold text-slate-950">{sectionTitle}</FieldLegend>
          <Separator className="bg-transparent" />
          {success && <Alert className="border-green-200 bg-green-50 text-green-900"><CheckCircle2 className="size-4" /><AlertTitle>Pending account created</AlertTitle><AlertDescription className="text-green-800">{success}</AlertDescription></Alert>}
          {(submitError || programError) && <Alert variant="destructive"><AlertCircle className="size-4" /><AlertTitle>Unable to save</AlertTitle><AlertDescription>{submitError || programError}</AlertDescription></Alert>}
          <FieldGroup className="grid gap-x-12 gap-y-6 md:grid-cols-2">
            <TextField name="first_name" label="First Name" value={values.first_name} onChange={handleChange} placeholder="Enter first name" icon={User} error={errors.first_name} />
            <TextField name="middle_name" label="Middle Name" optional value={values.middle_name} onChange={handleChange} placeholder="Enter middle name" icon={User} error={errors.middle_name} />
            <TextField name="last_name" label="Last Name" value={values.last_name} onChange={handleChange} placeholder="Enter last name" icon={User} error={errors.last_name} />
            <TextField name="email" label="Email Address" type="email" value={values.email} onChange={handleChange} placeholder="Enter institutional email" icon={Mail} error={errors.email} />
            <SelectField name="role" label="Role" value={values.role} onChange={handleChange} disabled={lockRole} error={errors.role}>{roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField>
            {needsProgram && <SelectField name="program_id" label="Program" loading={loadingPrograms} value={values.program_id} onChange={handleChange} error={errors.program_id}><option value="">Select program</option>{programOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField>}
            <TextField name="school_id_number" label="User ID" value={values.school_id_number} onChange={handleChange} placeholder="Enter school ID number" icon={IdCard} error={errors.school_id_number} />
          </FieldGroup>
          <div className="flex flex-col-reverse gap-3 pt-10 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel || (() => navigate(cancelPath))} disabled={submitting} className="h-9 rounded-[5px] border-slate-300 px-6 font-bold text-[#0b2f70]">Cancel</Button>
            <Button type="submit" disabled={submitting || (needsProgram && (loadingPrograms || Boolean(programError)))} className="h-9 rounded-[5px] bg-[#0b4bd3] px-6 font-bold text-white hover:bg-[#083da9]">{submitting && <Spinner className="mr-2" />}{submitting ? "Saving..." : submitLabel}</Button>
          </div>
        </FieldSet>
      </form>
    </div>
  </>;

  if (embedded) return formContent;

  return <AdminPageLayout>
    <PageBreadcrumbs className="mb-5" items={[{ label: parentLabel, to: cancelPath }, { label: title }]} />
    <div className="max-w-[960px]">{formContent}</div>
  </AdminPageLayout>;
}
