import { Input } from "@/components/ui/input";
import ContactNumberInput from "../components/ContactNumberInput";
import ErrorText from "../components/ErrorText";
import FieldLabel from "../components/FieldLabel";
import FormNavigation from "../components/FormNavigation";
import HeaderIdentity from "../components/HeaderIdentity";
import RadioOption from "../components/RadioOption";
import RequestShell from "../components/RequestShell";
import SectionBox from "../components/SectionBox";
import { programOptions } from "../constants";
import {
  controlClass,
  yearOptionsForProgram,
} from "../utils";

const inputClass = "h-11 rounded-[9px] text-sm shadow-none";

function TextField({ label, error, children }) {
  return (
    <SectionBox invalid={Boolean(error)}>
      <div className="grid gap-2">
        <FieldLabel>{label}</FieldLabel>
        {children}
        <ErrorText message={error} />
      </div>
    </SectionBox>
  );
}

export default function StudentInfoStep({
  step,
  form,
  user,
  fieldErrors,
  updateField,
  handleRadioClick,
  onBack,
  onNext,
}) {
  const programs = form.program && !programOptions.includes(form.program)
    ? [...programOptions, form.program]
    : programOptions;
  return (
    <RequestShell requestType={form.requestType} step={step}>
      <HeaderIdentity requestType={form.requestType} step={step} user={user} />

      <SectionBox
        invalid={Boolean(fieldErrors.studentName)}
        title="Student Information"
      >
        <div className="grid gap-2">
          <FieldLabel>Student Name</FieldLabel>
          <Input
            value={form.studentName}
            aria-label="Student Name"
            readOnly
            aria-invalid={Boolean(fieldErrors.studentName)}
            className={controlClass(fieldErrors.studentName, inputClass)}
          />
          <ErrorText message={fieldErrors.studentName} />
        </div>
      </SectionBox>

      <SectionBox invalid={Boolean(fieldErrors.program)} title="Program">
        <fieldset disabled aria-label="Program" className="grid gap-2 sm:grid-cols-2 [&_label]:cursor-default">
          {programs.map((program) => (
            <RadioOption
              key={program}
              name="program"
              value={program}
              checked={form.program === program}
              onToggle={handleRadioClick}
              onChange={updateField}
            />
          ))}
        </fieldset>
        <ErrorText message={fieldErrors.program} />
      </SectionBox>

      <SectionBox invalid={Boolean(fieldErrors.level)} title="Level">
        <fieldset disabled aria-label="Level" className="grid gap-2 sm:grid-cols-4 [&_label]:cursor-default">
          {yearOptionsForProgram(form.program).map((year) => (
            <RadioOption
              key={year}
              name="level"
              value={year}
              checked={form.level === year}
              onToggle={handleRadioClick}
              onChange={updateField}
            />
          ))}
        </fieldset>
        <ErrorText message={fieldErrors.level} />
      </SectionBox>

      <TextField label="Parent/Guardian's Name" error={fieldErrors.guardianName}>
        <Input
          name="guardianName"
          aria-label="Parent/Guardian's Name"
          value={form.guardianName}
          onChange={(event) => updateField("guardianName", event.target.value)}
          placeholder="Add text here..."
          aria-invalid={Boolean(fieldErrors.guardianName)}
          className={controlClass(fieldErrors.guardianName, inputClass)}
        />
      </TextField>

      <TextField label="Contact Number" error={fieldErrors.contactNumber}>
        <ContactNumberInput
          value={form.contactNumber}
          onChange={(value) => updateField("contactNumber", value)}
          error={fieldErrors.contactNumber}
        />
      </TextField>

      <TextField label="Date Submitted" error={fieldErrors.dateSubmitted}>
        <Input
          type="date"
          value={form.dateSubmitted}
          onChange={(event) => updateField("dateSubmitted", event.target.value)}
          aria-invalid={Boolean(fieldErrors.dateSubmitted)}
          className={controlClass(fieldErrors.dateSubmitted, inputClass)}
        />
      </TextField>

      <FormNavigation onBack={onBack} onNext={onNext} />
    </RequestShell>
  );
}
