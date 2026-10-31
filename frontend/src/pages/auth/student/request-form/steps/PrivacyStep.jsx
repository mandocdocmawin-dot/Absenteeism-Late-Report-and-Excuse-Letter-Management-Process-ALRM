import ErrorText from "../components/ErrorText";
import FormNavigation from "../components/FormNavigation";
import HeaderIdentity from "../components/HeaderIdentity";
import RadioOption from "../components/RadioOption";
import RequestShell from "../components/RequestShell";
import SectionBox from "../components/SectionBox";

export default function PrivacyStep({
  step,
  form,
  user,
  fieldErrors,
  updateField,
  handleRadioClick,
  onBack,
  onNext,
}) {
  return (
    <RequestShell requestType={form.requestType} step={step}>
      <HeaderIdentity requestType={form.requestType} step={step} user={user} />
      <SectionBox title="Data Privacy Notice">
        <p className="text-sm leading-relaxed text-slate-700">
          In compliance with data privacy laws, including Republic Act No. 10173
          Philippine Data Privacy Act of 2012, the Higher Education Department
          collects, uses, stores, and processes your personal information in
          this form for documentation and attendance tracking purposes only.
        </p>
        <p className="text-sm leading-relaxed text-slate-700">
          For your data privacy inquiries, you may reach our Data Protection
          Officer through:
        </p>
        <p className="text-sm font-semibold text-slate-700">
          Email: dpo@laverdad.edu.ph
        </p>
      </SectionBox>

      <SectionBox
        invalid={Boolean(fieldErrors.consent)}
        title="Compliance and Consent"
      >
        <p className="text-sm leading-relaxed text-slate-700">
          By ticking "I Agree", I voluntarily give my consent to LVCC in
          collecting, processing, recording, using, and retaining my personal
          information for the above-mentioned purpose in accordance with this
          Privacy Notice.
        </p>
        <div className="grid grid-cols-1 gap-2">
          <RadioOption
            name="consent"
            value="agree"
            label="I Agree"
            checked={form.consent === "agree"}
            onToggle={handleRadioClick}
            onChange={updateField}
          />
          <RadioOption
            name="consent"
            value="disagree"
            label="I Disagree"
            checked={form.consent === "disagree"}
            onToggle={handleRadioClick}
            onChange={updateField}
          />
        </div>
        <ErrorText message={fieldErrors.consent} />
      </SectionBox>
      <FormNavigation onBack={onBack} onNext={onNext} />
    </RequestShell>
  );
}
