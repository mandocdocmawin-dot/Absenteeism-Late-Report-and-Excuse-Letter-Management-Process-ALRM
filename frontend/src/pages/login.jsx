import { Button } from "@/components/ui/button";
import { Navigate } from "react-router-dom";
import SessionStatus from "@/components/SessionStatus";
import { useAuth } from "@/context/AuthContext";
import { getPostLoginPath } from "@/api/authSecurity";
import MobileAuthBrand from "@/components/auth/MobileAuthBrand";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { googleLoginUrl } from "../api/client";
import lvLogo from "../assets/lv-logo-auth.webp";
import lvPicture from "../assets/LV_Picture.jpg";

function GoogleIcon() {
  return (
    <svg className="size-[clamp(1rem,1.6vw,1.25rem)]" viewBox="0 0 24 24" aria-hidden="true">
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
      width="384"
      height="384"
      fetchPriority="high"
      alt="La Verdad Christian College logo"
      className="size-[clamp(5rem,10vw,9rem)] object-contain drop-shadow-2xl"
    />
  );
}

function Login() {
  const { user, loading, sessionError } = useAuth();

  if (!user && (loading || sessionError)) return <SessionStatus />;
  if (user) return <Navigate to={getPostLoginPath(user)} replace />;

  function handleGoogleLogin() {
    window.location.href = googleLoginUrl();
  }

  return (
    <main className="flex min-h-svh flex-col bg-[#132351] text-slate-900 sm:grid sm:min-h-screen sm:grid-cols-[48%_52%] sm:bg-white">
      <MobileAuthBrand />
      <section
        className="relative hidden min-h-screen place-items-center overflow-hidden bg-[#07152a] bg-cover bg-center px-6 text-white sm:grid lg:px-10"
        style={{
          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.86), rgba(15, 23, 42, 0.92)), url(${lvPicture})`,
        }}
      >
        <div className="relative -mt-[clamp(2rem,6.25vw,5rem)] grid justify-items-center gap-[clamp(1rem,2.5vw,2rem)] text-center">
          <SchoolSeal />

          <div className="space-y-[clamp(0.5rem,1.25vw,1rem)]">
            <h1 className="text-[clamp(1.5rem,3.75vw,3rem)] font-black tracking-normal text-white">
              ALRM SYSTEM
            </h1>
            <p className="mx-auto max-w-[260px] text-[clamp(0.75rem,1.5625vw,1.25rem)] leading-snug text-slate-100">
              Absence and Late Report Management System
            </p>
          </div>
        </div>
      </section>

      <section className="relative -mt-10 flex min-h-[calc(40svh+2.5rem)] flex-1 flex-col items-center rounded-t-[40px] bg-white px-[clamp(1.25rem,7vw,2rem)] pb-10 pt-[clamp(2rem,5.7svh,3rem)] sm:m-0 sm:grid sm:min-h-screen sm:place-items-center sm:rounded-none sm:px-[clamp(1rem,3vw,2rem)] sm:py-12">
        <Card className="w-full max-w-[500px] gap-[clamp(0.5rem,1.25vw,1rem)] border-0 bg-transparent py-0 shadow-none ring-0">
          <CardHeader className="items-center gap-2 px-0 text-center">
            <CardTitle className="text-[clamp(1.375rem,calc(1rem+2vw),3rem)] font-bold leading-tight tracking-normal text-black sm:font-black sm:text-slate-800">
              Welcome Back!
            </CardTitle>
            <CardDescription className="max-w-56 text-center text-[clamp(0.6875rem,calc(0.5rem+0.9vw),1.125rem)] font-normal leading-snug text-[#737373] sm:max-w-none sm:text-slate-600">
              Sign in with your La Verdad Christian College account.
            </CardDescription>
          </CardHeader>

          <CardFooter className="flex-col gap-[clamp(1.25rem,3vw,2rem)] border-0 bg-transparent px-0 pt-[clamp(1rem,3.2vw,2.5rem)]">
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleLogin}
              className="h-[clamp(2.75rem,calc(2.25rem+1.25vw),3.25rem)] w-[min(100%,clamp(13rem,72vw,22rem))] gap-[clamp(0.5rem,1vw,0.75rem)] rounded-[5px] border-slate-300 bg-white text-[clamp(0.75rem,calc(0.65rem+0.55vw),1rem)] font-semibold text-[#404040] shadow-sm hover:bg-slate-50 sm:text-slate-700 sm:font-bold"
            >
              <GoogleIcon />
              Sign in with Google
            </Button>

            <p className="text-center text-[clamp(0.6875rem,calc(0.6rem+0.3vw),0.8125rem)] font-normal italic text-[#737373] sm:font-semibold sm:text-slate-500">
              Use your official LV email account to login.
            </p>
          </CardFooter>
        </Card>
      </section>
    </main>
  );
}

export default Login;
