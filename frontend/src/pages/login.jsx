import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { googleLoginUrl } from "../api/client";

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.24 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function SchoolSeal() {
  return (
    <div className="grid size-36 place-items-center rounded-full border-[6px] border-[#d9b46a] bg-white shadow-2xl shadow-black/30">
      <div className="grid size-28 place-items-center rounded-full border-2 border-slate-300 bg-slate-50 text-center text-slate-900">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase leading-none tracking-wide">
            La Verdad
          </p>
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-sky-100 text-lg font-black text-sky-800">
            LV
          </div>
          <p className="text-[10px] font-bold uppercase leading-none">
            Christian College
          </p>
          <p className="text-[10px] font-black leading-none text-slate-600">
            2005
          </p>
        </div>
      </div>
    </div>
  );
}

function Login() {
  function handleGoogleLogin() {
    window.location.href = googleLoginUrl();
  }

  return (
    <main className="grid min-h-screen bg-white text-slate-900 md:grid-cols-[48%_52%]">
      <section
        className="relative hidden min-h-screen place-items-center overflow-hidden bg-[#111c2e] px-10 text-white md:grid"
        style={{
          backgroundImage:
            "linear-gradient(rgba(17, 28, 46, 0.9), rgba(17, 28, 46, 0.94)), radial-gradient(circle at 30% 15%, rgba(80, 112, 154, 0.2), transparent 34%), linear-gradient(135deg, #1d2b43, #0f1726)",
        }}
      >
        <div className="absolute inset-0 opacity-20">
          <div className="absolute bottom-0 left-0 h-3/4 w-full bg-[linear-gradient(155deg,transparent_0_18%,rgba(255,255,255,.12)_18%_19%,transparent_19%_100%)]" />
          <div className="absolute bottom-0 left-10 h-2/3 w-40 border-l border-r border-white/20" />
          <div className="absolute bottom-0 left-32 h-4/5 w-56 border-l border-r border-white/10" />
          <div className="absolute bottom-0 right-16 h-3/4 w-52 border-l border-r border-white/10" />
        </div>

        <div className="relative -mt-20 grid justify-items-center gap-8 text-center">
          <SchoolSeal />

          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-normal text-white">
              ALRM SYSTEM
            </h1>
            <p className="mx-auto max-w-[260px] text-base font-bold leading-snug text-slate-100">
              Absence and Late Report Management System
            </p>
          </div>
        </div>
      </section>

      <section className="grid min-h-screen place-items-center px-6 py-12">
        <div className="mb-10 grid justify-items-center gap-4 text-center md:hidden">
          <SchoolSeal />
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-normal text-slate-900">
              ALRM SYSTEM
            </h1>
            <p className="max-w-[260px] text-sm font-semibold leading-snug text-slate-600">
              Absence and Late Report Management System
            </p>
          </div>
        </div>

        <Card className="w-full max-w-[360px] border-0 bg-transparent py-0 shadow-none ring-0">
          <CardHeader className="items-center gap-3 px-0 text-center">
            <CardTitle className="text-[28px] font-black tracking-normal text-slate-800">
              Welcome Back!
            </CardTitle>
            <CardDescription className="text-[15px] text-slate-600">
              Sign in to your account
            </CardDescription>
          </CardHeader>

          <CardFooter className="flex-col gap-8 border-0 bg-transparent px-0 pt-10">
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleLogin}
              className="h-11 w-full max-w-[282px] gap-3 rounded-[5px] border-slate-300 bg-white text-base font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <GoogleIcon />
              Sign in with Google
            </Button>

            <p className="text-center text-xs font-semibold italic text-slate-500">
              Use your official LV email account to login.
            </p>
          </CardFooter>
        </Card>
      </section>
    </main>
  );
}

export default Login;