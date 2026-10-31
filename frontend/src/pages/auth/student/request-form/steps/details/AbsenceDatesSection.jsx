import { Input } from "@/components/ui/input";
import ErrorText from "../../components/ErrorText";
import FieldLabel from "../../components/FieldLabel";
import SectionBox from "../../components/SectionBox";
import { controlClass } from "../../utils";

const inputClass = "h-11 rounded-[9px] text-sm shadow-none";

export default function AbsenceDatesSection({ form, fieldErrors, updateField }) {
  return (
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
            className={controlClass(fieldErrors.startDateOfAbsence, inputClass)}
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
            className={controlClass(fieldErrors.endDateOfAbsence, inputClass)}
          />
          <ErrorText message={fieldErrors.endDateOfAbsence} />
        </div>
      </SectionBox>
    </>
  );
}
