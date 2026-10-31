import { LockKeyhole, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { studentProfile } from "../dashboard/studentOverview";
import LoadingSkeleton from "@/components/loading/LoadingSkeleton";

function ProfileField({ label, value, locked = false, id, loading = false }) {
  return <div className="grid min-w-0 gap-2">
    <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
    {loading ? <LoadingSkeleton variant="field" label={`Loading ${label.toLowerCase()}...`} /> : <div className="relative min-w-0">
      <Input id={id} value={value} readOnly title={value} className={`h-10 rounded-sm border-slate-200 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200 ${locked ? "bg-blue-50 pr-9 dark:bg-blue-950/40" : "bg-white dark:bg-slate-900"}`} />
      {locked && <LockKeyhole className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" aria-hidden="true" />}
    </div>}
  </div>;
}

export default function StudentProfileSection({ user, classes, loading }) {
  const profile = studentProfile(user, classes);
  return <section aria-labelledby="student-profile-title" className="px-0 py-10 sm:px-8">
    <h2 id="student-profile-title" className="mb-5 flex items-center gap-2 text-lg font-semibold"><UserRound className="size-5 shrink-0 text-blue-500 dark:text-blue-400" aria-hidden="true" />Profile</h2>
    <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
      <ProfileField id="student-full-name" label="Full Name" value={profile.name} />
      <ProfileField id="student-school-id" label="Student ID" value={profile.studentId} locked />
      <ProfileField id="student-academic-profile" label="Program & Year Level" value={profile.academic} loading={loading} locked />
      <ProfileField id="student-email" label="Email Address" value={user?.email || "Not available"} />
    </div>
    <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">Your name and email are managed through your LV account. Contact your administrator to update academic details.</p>
  </section>;
}
