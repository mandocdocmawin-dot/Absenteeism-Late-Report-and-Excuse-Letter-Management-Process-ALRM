import {
  ArrowLeft,
  CircleAlert,
  FileQuestion,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  RefreshCw,
  ServerCrash,
  ShieldX,
  WifiOff,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import LVLogo from "@/assets/lv-logo-auth.webp";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

const ERROR_DETAILS = {
  400: {
    title: "Bad Request",
    description: "The server cannot understand the request because of bad syntax.",
    label: "Request error",
    icon: CircleAlert,
    accent: "text-amber-600 dark:text-amber-400",
    iconStyle: "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  },
  401: {
    title: "Unauthorized",
    description: "You must log in with valid credentials before you can view the page.",
    label: "Authentication required",
    icon: LockKeyhole,
    accent: "text-blue-700 dark:text-blue-300",
    iconStyle: "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300",
  },
  403: {
    title: "Forbidden",
    description: "The server understands your request, but refuses to give you access.",
    label: "Access denied",
    icon: ShieldX,
    accent: "text-orange-700 dark:text-orange-300",
    iconStyle: "bg-orange-100 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300",
  },
  404: {
    title: "Not Found",
    description: "The server cannot find the specific web address or file you requested.",
    label: "Page unavailable",
    icon: FileQuestion,
    accent: "text-[#203b82] dark:text-blue-300",
    iconStyle: "bg-blue-100 text-[#203b82] dark:bg-blue-400/10 dark:text-blue-300",
  },
  500: {
    title: "Internal Server Error",
    description: "The web server hit an unexpected problem while trying to load the site.",
    label: "Unexpected error",
    icon: ServerCrash,
    accent: "text-red-700 dark:text-red-300",
    iconStyle: "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300",
  },
  503: {
    title: "Service Unavailable",
    description: "The service is temporarily unavailable. Please try again shortly.",
    label: "Service interruption",
    icon: WifiOff,
    accent: "text-violet-700 dark:text-violet-300",
    iconStyle: "bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300",
  },
};

function HttpErrorPage({ status = 404, description, onRetry }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const details = ERROR_DETAILS[status] ?? ERROR_DETAILS[500];
  const Icon = details.icon;
  const destination = user ? "/dashboard" : "/login";
  const destinationLabel = user ? "Go to dashboard" : "Go to sign in";
  const DestinationIcon = user ? LayoutDashboard : LogIn;
  const canRetry = status === 500 || status === 503;
  const secondaryActionGoesBack = status === 401 || status === 403 || status === 404;

  function handlePrimaryAction() {
    if (canRetry) {
      if (onRetry) {
        onRetry();
        return;
      }
      window.location.reload();
      return;
    }

    if (status === 400) {
      navigate(-1);
      return;
    }

    navigate(destination, { replace: status === 401 });
  }

  const primaryLabel = canRetry
    ? "Try again"
    : status === 400
      ? "Go back"
      : destinationLabel;
  const PrimaryIcon = canRetry
    ? RefreshCw
    : status === 400
      ? ArrowLeft
      : DestinationIcon;

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f6fa] text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-50">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex min-h-18 w-full max-w-7xl items-center justify-between px-5 py-3 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={LVLogo}
              width="384"
              height="384"
              alt="La Verdad Christian College logo"
              className="size-10 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="truncate text-base font-black text-[#101c4a] dark:text-white">
                ALRM SYSTEM
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                Absenteeism and Late Report Management
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
        <section
          role="alert"
          aria-labelledby="error-title"
          className="grid gap-8 border-y border-slate-200 py-10 dark:border-slate-800 sm:py-14 lg:grid-cols-[220px_1fr] lg:gap-16"
        >
          <div className="flex items-start justify-between gap-5 lg:block">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                HTTP status
              </p>
              <p className={`mt-1 text-7xl font-black sm:text-8xl ${details.accent}`}>
                {status}
              </p>
            </div>
            <div className={`flex size-14 shrink-0 items-center justify-center rounded-[8px] lg:mt-8 ${details.iconStyle}`}>
              <Icon className="size-7" strokeWidth={2} aria-hidden="true" />
            </div>
          </div>

          <div className="max-w-2xl">
            <p className={`text-sm font-black uppercase ${details.accent}`}>
              {details.label}
            </p>
            <h1 id="error-title" className="mt-3 text-3xl font-black sm:text-4xl">
              {details.title}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
              {description || details.description}
            </p>

            {status === 404 && (
              <p className="mt-5 break-all border-l-2 border-slate-300 pl-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Requested path: <span className="font-semibold text-slate-700 dark:text-slate-200">{location.pathname}</span>
              </p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                type="button"
                size="lg"
                onClick={handlePrimaryAction}
                className="h-10 rounded-[6px] bg-[#101c4a] px-4 font-bold text-white hover:bg-[#203b82]"
              >
                <PrimaryIcon className="size-4" />
                {primaryLabel}
              </Button>
              {!secondaryActionGoesBack && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => navigate(destination)}
                  className="h-10 rounded-[6px] border-slate-300 px-4 font-bold dark:border-slate-700"
                >
                  <DestinationIcon className="size-4" />
                  {destinationLabel}
                </Button>
              )}
              {secondaryActionGoesBack && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => navigate(-1)}
                  className="h-10 rounded-[6px] border-slate-300 px-4 font-bold dark:border-slate-700"
                >
                  <ArrowLeft className="size-4" />
                  Go back
                </Button>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="px-5 py-5 text-center text-xs text-slate-500 dark:text-slate-500">
        La Verdad Christian College · ALRM System
      </footer>
    </div>
  );
}

export default HttpErrorPage;
