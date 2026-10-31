import { Check } from "lucide-react";
import { flowSteps } from "../utils";

export default function RequestStepper({ currentStep, requestType }) {
  const steps = flowSteps(requestType);
  const fillWidth =
    steps.length <= 1 ? 0 : (currentStep / (steps.length - 1)) * 100;

  return (
    <div className="mb-8 w-full px-4 sm:px-6">
      <div className="relative flex items-start justify-between">
        <div className="absolute left-[19px] right-[19px] top-[19px] h-0.5 bg-slate-200">
          <div
            className="h-0.5 bg-[#2E9E6B] transition-all duration-500"
            style={{ width: `${fillWidth}%` }}
          />
        </div>

        {steps.map((label, index) => {
          const done = index < currentStep;
          const active = index === currentStep;

          return (
            <div
              key={`${label}-${index}`}
              className={[
                "relative z-10 flex flex-1 flex-col items-center",
                index === 0 ? "items-start" : "",
                index === steps.length - 1 ? "items-end" : "",
              ].join(" ")}
            >
              <div
                className={[
                  "flex size-[38px] items-center justify-center rounded-full border-2 text-sm font-bold transition-all",
                  done
                    ? "border-[#2E9E6B] bg-[#2E9E6B] text-white"
                    : active
                      ? "border-[#101C4A] bg-[#101C4A] text-white shadow-[0_0_0_5px_rgba(16,28,74,0.12)]"
                      : "border-slate-200 bg-white text-slate-400",
                ].join(" ")}
              >
                {done ? <Check className="size-5" strokeWidth={3} /> : index + 1}
              </div>
              <p
                className={[
                  "mt-2 hidden max-w-[90px] text-center text-xs font-medium sm:block",
                  active
                    ? "font-bold text-[#101C4A]"
                    : done
                      ? "text-slate-900"
                      : "text-slate-400",
                  index === 0 ? "text-left" : "",
                  index === steps.length - 1 ? "text-right" : "",
                ].join(" ")}
              >
                {label}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs font-medium text-slate-500">
        Step {currentStep + 1} of {steps.length} - {steps[currentStep]}
      </p>
    </div>
  );
}
