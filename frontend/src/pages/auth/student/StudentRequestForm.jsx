import RequestPageCanvas from "./request-form/components/RequestPageCanvas";
import AttachmentStep from "./request-form/steps/AttachmentStep";
import DetailsStep from "./request-form/steps/DetailsStep";
import InstructionsStep from "./request-form/steps/InstructionsStep";
import PrivacyStep from "./request-form/steps/PrivacyStep";
import RequestTypeStep from "./request-form/steps/RequestTypeStep";
import ReviewStep from "./request-form/steps/ReviewStep";
import StudentInfoStep from "./request-form/steps/StudentInfoStep";
import SubmittedView from "./request-form/steps/SubmittedView";
import useRequestForm from "./request-form/useRequestForm";
import StudentPageLayout from "./StudentPageLayout";

function StudentRequestForm() {
  const f = useRequestForm();
  const { step, form, user } = f;

  if (f.submitted) {
    return (
      <StudentPageLayout>
        <RequestPageCanvas>
          <SubmittedView requestType={form.requestType} onReset={f.resetForm} />
        </RequestPageCanvas>
      </StudentPageLayout>
    );
  }

  // Props na pare-pareho sa karamihan ng steps
  const common = {
    step,
    form,
    user,
    fieldErrors: f.fieldErrors,
    updateField: f.updateField,
    onBack: f.previousStep,
    onNext: f.nextStep,
  };

  return (
    <StudentPageLayout>
      <RequestPageCanvas>
        <form className="grid gap-4" aria-busy={f.submitting} onSubmit={f.handleSubmit}>
          {step === 0 && <RequestTypeStep {...common} />}
          {step === 1 && <InstructionsStep {...common} />}
          {step === 2 && (
            <PrivacyStep {...common} handleRadioClick={f.handleRadioClick} />
          )}
          {step === 3 && (
            <StudentInfoStep
              {...common}
              handleRadioClick={f.handleRadioClick}
            />
          )}
          {step === 4 && (
            <DetailsStep
              {...common}
              toggleListField={f.toggleListField}
              classes={f.classes}
              classesLoading={f.classesLoading}
              classesError={f.classesError}
            />
          )}
          {step === 5 && (
            <AttachmentStep {...common} toggleListField={f.toggleListField} />
          )}
          {step === 6 && (
            <ReviewStep
              {...common}
              classes={f.classes}
              classesLoading={f.classesLoading}
              classesError={f.classesError}
              error={f.error}
              reviewEditing={f.reviewEditing}
              onStartEdit={f.startReviewEdit}
              onSaveEdit={f.saveReviewEdit}
              toggleListField={f.toggleListField}
              submitting={f.submitting}
              uploading={f.uploading}
            />
          )}
        </form>
      </RequestPageCanvas>
    </StudentPageLayout>
  );
}

export default StudentRequestForm;
