import FormNavigation from "../components/FormNavigation";
import HeaderIdentity from "../components/HeaderIdentity";
import RequestShell from "../components/RequestShell";

export default function InstructionsStep({ step, form, user, onBack, onNext }) {
  return (
    <RequestShell requestType={form.requestType} step={step}>
      <HeaderIdentity requestType={form.requestType} step={step} user={user} />
      <p className="text-sm leading-relaxed text-slate-700">
        This form is used by students of the Higher Education Department to
        formally notify and request approval for{" "}
        {form.requestType === "absence" ? "an absence" : "tardiness"} from
        classes and other academic activities. It serves as an official record
        and provides the necessary information, explanation, and supporting
        documents for evaluation and approval.
      </p>
      <p className="text-sm leading-relaxed text-slate-700">
        Students are required to complete this form accurately and submit
        relevant proof or documentation. Submission of this form does not
        automatically grant approval. All requests are subject to review and
        validation in accordance with the Higher Education Department process.
      </p>
      <FormNavigation onBack={onBack} onNext={onNext} />
    </RequestShell>
  );
}
