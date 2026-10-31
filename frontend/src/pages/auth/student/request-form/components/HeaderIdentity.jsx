import { requestTitle } from "../utils";
import Eyebrow from "./Eyebrow";
import RequestTitle from "./RequestTitle";

export default function HeaderIdentity({ requestType, step, user }) {
  return (
    <div className="grid gap-2">
      <Eyebrow step={step} requestType={requestType} />
      <RequestTitle>
        {requestTitle(requestType)} -{" "}
        <span className="font-medium">Higher Education Department</span>
      </RequestTitle>
      <p className="text-xs font-bold text-slate-700">
        {user?.email || "student@laverdad.edu.ph"}
      </p>
      <p className="max-w-[520px] text-sm leading-relaxed text-slate-500">
        The name, email address and photo associated with your Google Account
        will be recorded when you upload files and submit this form.
      </p>
    </div>
  );
}
