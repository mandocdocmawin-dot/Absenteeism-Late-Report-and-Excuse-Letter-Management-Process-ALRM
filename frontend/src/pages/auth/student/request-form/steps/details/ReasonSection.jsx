import { Input } from "@/components/ui/input";
import ErrorText from "../../components/ErrorText";
import FieldLabel from "../../components/FieldLabel";
import SectionBox from "../../components/SectionBox";
import { absenceReasonOptions, LIMITS } from "../../constants";
import { controlClass } from "../../utils";

export default function ReasonSection({
  form,
  fieldErrors,
  updateField,
  toggleListField,
}) {
  if (form.requestType === "absence") {
    return (
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
                onChange={() => toggleListField("absenceReasons", reason)}
                className="accent-[#101C4A]"
              />
              {reason}
            </label>
          ))}
          <ErrorText message={fieldErrors.absenceReasons} />
        </div>
      </SectionBox>
    );
  }

  return (
    <SectionBox invalid={Boolean(fieldErrors.reason)}>
      <div className="grid gap-2">
        <FieldLabel>Reason</FieldLabel>
        <Input
          value={form.reason}
          maxLength={LIMITS.reason}
          onChange={(event) => updateField("reason", event.target.value)}
          aria-invalid={Boolean(fieldErrors.reason)}
          className={controlClass(
            fieldErrors.reason,
            "h-11 rounded-[9px] text-sm shadow-none",
          )}
        />
        <ErrorText message={fieldErrors.reason} />
      </div>
    </SectionBox>
  );
}
