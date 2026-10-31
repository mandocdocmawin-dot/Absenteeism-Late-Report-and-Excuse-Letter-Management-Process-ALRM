import FormNavigation from "../components/FormNavigation";
import HeaderIdentity from "../components/HeaderIdentity";
import RequestShell from "../components/RequestShell";
import AbsenceDatesSection from "./details/AbsenceDatesSection";
import ClassSection from "./details/ClassSection";
import LateMinutesSection from "./details/LateMinutesSection";
import ReasonSection from "./details/ReasonSection";

export default function DetailsStep({
  step,
  form,
  user,
  fieldErrors,
  updateField,
  toggleListField,
  classes,
  classesLoading,
  classesError,
  onBack,
  onNext,
}) {
  const sectionProps = { form, fieldErrors, updateField };

  return (
    <RequestShell requestType={form.requestType} step={step}>
      <HeaderIdentity requestType={form.requestType} step={step} user={user} />

      {form.requestType === "absence" ? (
        <AbsenceDatesSection {...sectionProps} />
      ) : (
        <LateMinutesSection {...sectionProps} />
      )}

      <ClassSection
        {...sectionProps}
        classes={classes}
        classesLoading={classesLoading}
        classesError={classesError}
      />

      <ReasonSection {...sectionProps} toggleListField={toggleListField} />

      <FormNavigation onBack={onBack} onNext={onNext} />
    </RequestShell>
  );
}
