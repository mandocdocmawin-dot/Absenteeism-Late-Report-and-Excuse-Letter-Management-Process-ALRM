import ErrorText from "../../components/ErrorText";
import SectionBox from "../../components/SectionBox";
import { classLabel, controlClass } from "../../utils";
import LoadingSkeleton from "@/components/loading/LoadingSkeleton";

export default function ClassSection({
  form,
  fieldErrors,
  updateField,
  classes,
  classesLoading,
  classesError,
}) {
  const isAbsence = form.requestType === "absence";
  const error = fieldErrors.classId;

  return (
    <SectionBox
      invalid={Boolean(error)}
      title={isAbsence ? "Program" : "Program Subject/Class(es)"}
    >
      {isAbsence && (
        <p className="text-xs font-semibold text-slate-700">
          Subject/Class*
        </p>
      )}
      {classesLoading ? <LoadingSkeleton variant="field" label="Loading classes..." /> : <select
        value={form.classId}
        onChange={(event) => updateField("classId", event.target.value)}
        disabled={classesLoading}
        aria-invalid={Boolean(error)}
        className={controlClass(
          error,
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
      </select>}
      {classesError && (
        <p className="text-xs font-semibold text-red-600">{classesError}</p>
      )}
      <ErrorText message={error} />
    </SectionBox>
  );
}
