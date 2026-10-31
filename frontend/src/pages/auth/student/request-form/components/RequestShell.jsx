import { Card, CardContent } from "@/components/ui/card";
import RequestStepper from "./RequestStepper";

export default function RequestShell({ children, requestType, step }) {
  return (
    <div className="mx-auto w-full max-w-[760px]">
      <RequestStepper currentStep={step} requestType={requestType} />
      <Card className="rounded-2xl border border-slate-200 bg-white py-0 shadow-sm">
        <CardContent className="grid gap-5 px-5 py-7 sm:px-10 sm:py-9">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
