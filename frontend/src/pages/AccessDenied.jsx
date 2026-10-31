import { useState } from "react";
import { LogIn, ShieldAlert } from "lucide-react";
import { startGoogleLogin } from "@/api/auth";
import { clearToken } from "@/api/client";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";

export function AccessDenied({
  title = "Access denied",
  message = "This Google account is not authorized to access this system. Please sign in using an authorized LV account.",
}) {
  const [error, setError] = useState("");

  function chooseAnotherAccount() {
    clearToken();
    setError("");

    try {
      startGoogleLogin();
    } catch {
      setError("Google Sign-In could not be started.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-md bg-rose-50 text-rose-700">
          <ShieldAlert className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        {error ? (
          <div className="mt-4 text-left">
            <ErrorState message={error} />
          </div>
        ) : null}
        <Button type="button" onClick={chooseAnotherAccount} className="mt-6 w-full">
          <LogIn className="size-4" aria-hidden="true" />
          Sign in with another Google account
        </Button>
      </section>
    </main>
  );
}
