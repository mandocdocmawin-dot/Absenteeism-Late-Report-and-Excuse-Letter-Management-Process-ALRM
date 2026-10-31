import { useEffect, useState } from "react";
import { getStudentClasses } from "@/api/student";
import StudentProfileSection from "./settings/StudentProfileSection";
import StudentNotificationPreferences from "./settings/StudentNotificationPreferences";
import { useAuth } from "@/context/AuthContext";

export default function StudentSettings({ user }) {
  const { refreshUser } = useAuth();
  const [state, setState] = useState({ classes: [], loading: true, error: "" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    getStudentClasses().then((classes) => {
      if (alive) setState({ classes: Array.isArray(classes) ? classes : [], loading: false, error: "" });
    }).catch((error) => {
      if (alive) setState({ classes: [], loading: false, error: error.message || "Class details could not be loaded." });
    });
    return () => { alive = false; };
  }, [user?.id, retry]);

  return <div className="mx-auto max-w-6xl">
    <h1 className="text-xl font-bold">Settings</h1>
    <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">Manage your student profile information, notification preferences, and account security.</p>
    <StudentProfileSection user={user} classes={state.classes} loading={state.loading} />
    {state.error && <div role="alert" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-red-600 dark:text-red-400">{state.error}<button type="button" onClick={() => { setState((current) => ({ ...current, loading: true, error: "" })); setRetry((value) => value + 1); }} className="font-medium underline">Try again</button></div>}
    <StudentNotificationPreferences key={user?.id} user={user} onEmailSaved={() => refreshUser({ silent: true })} />
  </div>;
}
