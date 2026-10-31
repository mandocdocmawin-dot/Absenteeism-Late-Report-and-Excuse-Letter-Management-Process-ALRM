import { Login } from "@/login/Login";
import { Spinner } from "@/components/ui/spinner";
import { AccessDenied } from "@/pages/AccessDenied";
import { useAuth } from "./useAuth";

export function ProtectedRoute({ children }) {
  const { loading, user, error } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Spinner />
          Loading your ALRM workspace
        </div>
      </main>
    );
  }

  if (!user) {
    return <Login initialError={error || ""} />;
  }

  if (user.status === "pending" || !user.role) {
    return <AccessDenied title="Role assignment pending" message="Your LV account is signed in, but an administrator still needs to assign your staff role." />;
  }

  return children;
}
