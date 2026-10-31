import { CirclePlus, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { StudentClassDetailsPlaceholder } from "@/components/loading/DashboardSkeleton/StudentDashboardPlaceholder";
import { programShortName, studentProfile } from "./studentOverview";

export default function StudentDashboardHeading({ user, classes }) {
  const profile = studentProfile(user, classes.loading || classes.error ? [] : classes.data);
  const academic = [programShortName(profile.program), user?.year_level && `${user.year_level} Year`].filter(Boolean).join(" ");
  return <section className="grid grid-cols-1 items-start gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto]">
    <h1 className="order-1 min-w-0 text-[28px] font-bold leading-[34px] text-black dark:text-slate-50">Welcome, {profile.name}!</h1>
    <Link to="/student/request" className="order-3 mt-3 inline-flex min-h-[35px] shrink-0 items-center justify-center gap-1 rounded-[7px] bg-[#142c60] px-3 py-2 text-[13px] font-normal leading-[19px] text-white hover:bg-[#10284f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 sm:order-2 sm:mt-0">
      <CirclePlus className="size-4 shrink-0" aria-hidden="true" />Submit excuse letter
    </Link>
    <div className="order-2 col-span-full min-w-0 break-words text-[18px] leading-6 text-[#827b7b] dark:text-slate-400 sm:order-3">
      {[academic, `Student ID: ${profile.studentId}`].filter(Boolean).join(" \u2022 ")}
      {classes.loading ? <> &bull; <StudentClassDetailsPlaceholder /></> : classes.error ? <span role="alert" className="mt-1 flex flex-wrap items-center gap-2 text-sm text-rose-700 dark:text-rose-400">
        Class details unavailable. {classes.error}
        <button type="button" onClick={classes.reload} className="inline-flex min-h-9 items-center gap-1 rounded px-2 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"><RefreshCw aria-hidden="true" className="size-4" />Retry</button>
      </span> : profile.term ? <> &bull; {profile.term}</> : null}
    </div>
  </section>;
}
