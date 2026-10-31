import { LogIn, ShieldCheck } from "lucide-react";
import { startGoogleLogin } from "@/api/auth";
import { Button } from "@/components/ui/button";

export function Register({ navigate }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex size-12 items-center justify-center rounded-md bg-[#0B1428] text-white">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-slate-950">Use your LV Google account</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          ALRM does not use a separate registration form. Students are created automatically after Google sign in, while staff accounts wait for administrator role assignment.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button type="button" onClick={startGoogleLogin}>
            <LogIn className="size-4" aria-hidden="true" />
            Continue with Google
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/login")}>
            Back to login
          </Button>
        </div>
      </section>
    </main>
  );
}
