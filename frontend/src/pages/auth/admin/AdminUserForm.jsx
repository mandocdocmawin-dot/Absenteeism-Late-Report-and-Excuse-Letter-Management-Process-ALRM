import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, ChevronDown, IdCard, Mail, User } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { getAdminPrograms } from "@/api/adminUsers";
import AdminPageLayout from "./AdminPageLayout";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formErrorFrom(error) {
  if (error?.status === 404 || error?.status === 405) {
    return "The backend does not currently expose an admin create-user endpoint. No instructor or student was created.";
  }

  return error?.message || "Something went wrong while saving this account.";
}

function TextField({
  error,
  icon: Icon,
  label,
  name,
  onChange,
  placeholder,
  type = "text",
  value,
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            strokeWidth={1.7}
          />
        )}
        <Input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className={cn(
            "h-11 rounded-[5px] border-slate-300 text-sm shadow-none",
            Icon && "pl-9",
          )}
        />
      </div>
      <FieldError>{error}</FieldError>
    </Field>
  );
}

function SelectField({ error, label, name, onChange, value, children }) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <div className="relative">
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          className="h-11 w-full appearance-none rounded-[5px] border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
      </div>
      <FieldError>{error}</FieldError>
    </Field>
  );
}

function AdminUserForm({
  cancelPath,
  createUser,
  fields,
  initialValues,
  sectionTitle,
  submitLabel,
  subtitle,
  title,
  validate,
}) {
  const navigate = useNavigate();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [programError, setProgramError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadPrograms() {
      setLoadingPrograms(true);
      setProgramError("");

      try {
        const data = await getAdminPrograms();
        if (alive) setPrograms(data);
      } catch (error) {
        if (alive) {
          setProgramError(
            error?.message || "Unable to load programs from the backend.",
          );
        }
      } finally {
        if (alive) setLoadingPrograms(false);
      }
    }

    loadPrograms();

    return () => {
      alive = false;
    };
  }, []);

  const programOptions = useMemo(
    () =>
      programs.map((program) => ({
        label: program.program_name || program.name || `Program ${program.id}`,
        value: String(program.id),
      })),
    [programs],
  );

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setSuccess("");
    setSubmitError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate(values);

    setErrors(nextErrors);
    setSuccess("");
    setSubmitError("");

    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);

    try {
      await createUser(values);
      setSuccess(`${title} saved successfully.`);
      setValues(initialValues);
      setErrors({});
    } catch (error) {
      setSubmitError(formErrorFrom(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminPageLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-normal text-slate-950">
          {title}
        </h1>
        <p className="mt-1 text-sm font-medium text-slate-600">{subtitle}</p>
      </div>

      <Card className="w-full max-w-[960px] rounded-[5px] border border-slate-300 py-0 shadow-none ring-0">
        <CardContent className="px-5 py-7 sm:px-8">
          <form onSubmit={handleSubmit} noValidate>
            <FieldSet>
              <FieldLegend className="text-base font-bold text-slate-950">
                {sectionTitle}
              </FieldLegend>
              <Separator className="bg-transparent" />

              {success && (
                <Alert className="border-green-200 bg-green-50 text-green-900">
                  <CheckCircle2 className="size-4" />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription className="text-green-800">
                    {success}
                  </AlertDescription>
                </Alert>
              )}

              {(submitError || programError) && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Unable to save</AlertTitle>
                  <AlertDescription>
                    {submitError || programError}
                  </AlertDescription>
                </Alert>
              )}

              <FieldGroup className="grid gap-x-12 gap-y-6 md:grid-cols-2">
                {fields.map((field) => {
                  if (field.type === "program") {
                    return (
                      <SelectField
                        key={field.name}
                        name={field.name}
                        label={field.label}
                        value={values[field.name]}
                        onChange={handleChange}
                        error={errors[field.name]}
                      >
                        <option value="">
                          {loadingPrograms
                            ? "Loading programs..."
                            : "Select program"}
                        </option>
                        {programOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectField>
                    );
                  }

                  if (field.type === "select") {
                    return (
                      <SelectField
                        key={field.name}
                        name={field.name}
                        label={field.label}
                        value={values[field.name]}
                        onChange={handleChange}
                        error={errors[field.name]}
                      >
                        {field.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectField>
                    );
                  }

                  return (
                    <TextField
                      key={field.name}
                      name={field.name}
                      label={field.label}
                      type={field.type}
                      value={values[field.name]}
                      onChange={handleChange}
                      placeholder={field.placeholder}
                      icon={field.icon}
                      error={errors[field.name]}
                    />
                  );
                })}
              </FieldGroup>

              <div className="flex flex-col-reverse gap-3 pt-10 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(cancelPath)}
                  disabled={submitting}
                  className="h-9 rounded-[5px] border-slate-300 px-6 font-bold text-[#0b2f70]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-9 rounded-[5px] bg-[#0b4bd3] px-6 font-bold text-white hover:bg-[#083da9]"
                >
                  {submitting && <Spinner className="mr-2" />}
                  {submitting ? "Saving..." : submitLabel}
                </Button>
              </div>
            </FieldSet>
          </form>
        </CardContent>
      </Card>
    </AdminPageLayout>
  );
}

export { AdminUserForm, emailPattern, IdCard, Mail, User };
