import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { googleLoginUrl } from "../api/client";
import lvLogo from "../assets/LV_Logo.png";
import lvPicture from "../assets/LV_Picture.jpg";

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
    <img
      src={lvLogo}
      alt="La Verdad Christian College logo"
      className="size-36 object-contain drop-shadow-2xl"
    />
  );
}

function Login() {
  function handleGoogleLogin() {
    window.location.href = googleLoginUrl();
  }

  return (
    <main className="grid min-h-screen bg-white text-slate-900 md:grid-cols-[48%_52%]">
      <section
        className="relative hidden min-h-screen place-items-center overflow-hidden bg-[#07152a] bg-cover bg-center px-10 text-white md:grid"
        style={{
          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.86), rgba(15, 23, 42, 0.92)), url(${lvPicture})`,
        }}
      >
        <div className="relative -mt-20 grid justify-items-center gap-8 text-center">
          <SchoolSeal />

          <div className="space-y-4">
            <h1 className="text-5xl font-black tracking-normal text-white">
              ALRM SYSTEM
            </h1>
            <p className="mx-auto max-w-[260px] text-xl leading-snug text-slate-100">
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

        <Card className="w-full max-w-[500px] border-0 bg-transparent py-0 shadow-none ring-0">
          <CardHeader className="items-center gap-2 px-0 text-center">
            <CardTitle className="text-[48px] font-black tracking-normal text-slate-800">
              Welcome Back!
            </CardTitle>
            <CardDescription className="text-[18px] text-slate-600">
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
