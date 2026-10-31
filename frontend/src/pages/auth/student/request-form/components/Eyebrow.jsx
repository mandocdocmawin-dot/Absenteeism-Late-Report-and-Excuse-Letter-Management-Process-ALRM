import { flowSteps } from "../utils";

export default function Eyebrow({ step, requestType }) {
  const steps = flowSteps(requestType);

  return (
    <p className="text-xs font-bold text-[#2E9E6B]">
      Step {step + 1} of {steps.length}
    </p>
  );
}
