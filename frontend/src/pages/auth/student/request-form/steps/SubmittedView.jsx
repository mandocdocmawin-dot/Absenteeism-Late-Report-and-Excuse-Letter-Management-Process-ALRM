import { CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import RequestTitle from "../components/RequestTitle";
import { requestTitle } from "../utils";

export default function SubmittedView({ requestType, onReset }) {
  return (
    <div className="mx-auto w-full max-w-[760px]">
      <Card className="rounded-2xl border border-slate-200 bg-white py-0 shadow-sm">
        <CardContent className="grid gap-5 px-5 py-7 sm:px-10 sm:py-9">
          <div className="grid justify-items-center gap-4 py-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-[#2E9E6B]">
              <CheckCircle2 className="size-7" />
            </div>
            <RequestTitle>
              {requestTitle(requestType)} -{" "}
              <span className="font-medium">Higher Education Department</span>
            </RequestTitle>
            <p className="text-sm font-semibold text-slate-600">
              Your response has been recorded.
            </p>
            <button
              type="button"
              onClick={onReset}
              className="text-sm font-bold text-[#101C4A] underline-offset-4 hover:underline"
            >
              Submit another response
            </button>
            <Link
              to="/dashboard"
              className="rounded-sm text-sm font-semibold text-[#101C4A] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300"
            >
              Go back to dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
