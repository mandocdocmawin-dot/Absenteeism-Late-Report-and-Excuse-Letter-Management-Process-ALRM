import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, KeyRound, Mail } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getPostLoginPath } from "@/api/authSecurity";
import SessionStatus from "@/components/SessionStatus";
import { clearCallbackCredentials, googleLoginUrl } from "@/api/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import AuthLoading from "@/components/loading/AuthLoading";
import { useAuth } from "@/context/AuthContext";
import {
  checkTrustedDevice,
  clearPendingOtp,
  exchangeOtpCode,
  getExchangeCodeFromResponse,
  getOtpWaitSeconds,
  getPendingLogin,
  getPendingOtpEmail,
  getPendingOtpUserId,
  sendOtp,
  setPendingLogin,
  setPendingOtpSession,
  verifyOtp,
} from "@/api/otp";
import lvLogo from "@/assets/lv-logo-auth.webp";

const INITIAL_RESEND_WAIT_SECONDS = 5 * 60;

function formatCountdown(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function OtpVerification() {
  const { user, loading, sessionError } = useAuth();

  if (!user && (loading || sessionError)) return <SessionStatus />;
  if (user) return <Navigate to={getPostLoginPath(user)} replace />;

  return <OtpVerificationForm />;
}

function OtpVerificationForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeCookieLogin, logout } = useAuth();
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  // "pending" token mula sa Google callback. Sine-save sa sessionStorage
  // para hindi mawala kapag nag-refresh o nagbago ang URL.
  const pendingLogin = useMemo(() => {
    const fromUrl = searchParams.get("pending");

    if (fromUrl) {
      setPendingLogin(fromUrl);
      return fromUrl;
    }

    return getPendingLogin();
  }, [searchParams]);

  const exchangeFromUrl = searchParams.get("exchange_code");
  const alreadyChecked = searchParams.get("checked") === "1";
  const needsTrustedCheck =
    Boolean(exchangeFromUrl) || (Boolean(pendingLogin) && !alreadyChecked);

  const [checking, setChecking] = useState(needsTrustedCheck);
  const checkedRef = useRef(false);

  const pendingSession = useMemo(() => {
    const urlEmail = searchParams.get("email");
    const urlUserId = searchParams.get("user_id");

    if (urlUserId) {
      setPendingOtpSession({
        email: urlEmail,
        userId: urlUserId,
      });
      return { email: urlEmail, userId: urlUserId };
    }

    return {
      email: getPendingOtpEmail(),
      userId: getPendingOtpUserId(),
    };
  }, [searchParams]);
  const pendingEmail = pendingSession.email;
  const pendingUserId = pendingSession.userId;
  const hasPendingOtp = Boolean(pendingLogin && (pendingUserId || pendingEmail));
  const canSubmit = code.length === 6 && !verifying;
  const initialResendWaitSeconds = useMemo(
    () =>
      getOtpWaitSeconds(
        {
          data: {
            resend_after: searchParams.get("resend_after"),
            retry_after: searchParams.get("retry_after"),
            expires_in: searchParams.get("expires_in"),
          },
        },
        INITIAL_RESEND_WAIT_SECONDS,
      ),
    [searchParams],
  );
  const resendStorageKey = useMemo(() => {
    const keySource = pendingUserId || pendingEmail || "otp";

    return `otp_resend_ready_at:${keySource}`;
  }, [pendingEmail, pendingUserId]);

  function startResendCountdown(seconds) {
    const nextSeconds = Math.max(0, Math.ceil(Number(seconds) || 0));

    if (nextSeconds <= 0) {
      sessionStorage.removeItem(resendStorageKey);
      setResendSeconds(0);
      return;
    }

    sessionStorage.setItem(
      resendStorageKey,
      String(Date.now() + nextSeconds * 1000),
    );
    setResendSeconds(nextSeconds);
  }

  useEffect(() => { clearCallbackCredentials(); }, []);

  useEffect(() => {
    if (!needsTrustedCheck || checkedRef.current) return;
    checkedRef.current = true;

    (async () => {
      try {
        let exchangeCode = exchangeFromUrl;

        if (!exchangeCode) {
          const res = await checkTrustedDevice({ pending: pendingLogin });

          if (res?.data?.trusted) {
            exchangeCode = res?.data?.exchange_code;
          }
        }

        if (exchangeCode) {
          const exchangeRes = await exchangeOtpCode(exchangeCode);
          const verifiedUser = await completeCookieLogin(exchangeRes);
          clearPendingOtp();
          navigate(getPostLoginPath(verifiedUser), { replace: true });
          return;
        }
      } catch (checkError) {
        setError(checkError?.message || "Unable to verify this device.");
      }

      setChecking(false); // hindi trusted: ipakita ang OTP form
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsTrustedCheck]);

  useEffect(() => {
    if (!hasPendingOtp) return;

    const savedReadyAt = Number(sessionStorage.getItem(resendStorageKey));

    if (Number.isFinite(savedReadyAt) && savedReadyAt > Date.now()) {
      // Restore the countdown saved before this page was mounted.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResendSeconds(Math.ceil((savedReadyAt - Date.now()) / 1000));
      return;
    }

    startResendCountdown(initialResendWaitSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPendingOtp, initialResendWaitSeconds, resendStorageKey]);

  useEffect(() => {
    if (resendSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setResendSeconds((current) => {
        if (current <= 1) {
          sessionStorage.removeItem(resendStorageKey);
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendSeconds, resendStorageKey]);

  function handleCodeChange(event) {
    setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
    setError("");
  }

  async function handleResend() {
    if (!hasPendingOtp || resendSeconds > 0) return;

    setSending(true);
    setNotice("");
    setError("");

    try {
      const response = await sendOtp({
        userId: pendingUserId,
        email: pendingEmail,
        pending: pendingLogin,
      });
      startResendCountdown(
        getOtpWaitSeconds(response, initialResendWaitSeconds),
      );
      setNotice("A new OTP was sent to your LV email.");
    } catch (requestError) {
      const waitSeconds = getOtpWaitSeconds(requestError);

      if (waitSeconds > 0) {
        startResendCountdown(waitSeconds);
      }

      setError(
        requestError?.message ||
          "Unable to resend the OTP. Please use the latest OTP already sent to your LV email.",
      );
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!hasPendingOtp) {
      setError("Your login session has expired. Please sign in again.");
      return;
    }

    if (code.length !== 6) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setVerifying(true);
    setError("");
    setNotice("");

    try {
      const response = await verifyOtp({
        userId: pendingUserId,
        email: pendingEmail,
        code,
        pending: pendingLogin,
      });
      const exchangeCode = getExchangeCodeFromResponse(response);
      if (!exchangeCode) throw new Error("Verification succeeded, but the one-time sign-in code is missing.");
      const exchangeResponse = await exchangeOtpCode(exchangeCode);
      const verifiedUser = await completeCookieLogin(exchangeResponse);
      clearPendingOtp();
      navigate(getPostLoginPath(verifiedUser), {
        replace: true,
      });
    } catch (verifyError) {
      setError(
        verifyError?.message ||
          "The verification code is invalid, expired, or the backend verification endpoint is missing.",
      );
    } finally {
      setVerifying(false);
    }
  }

  async function handleBackToLogin() {
    clearPendingOtp();
    await logout();
    window.location.href = googleLoginUrl({ prompt: "select_account" });
  }

  if (checking) {
    return <AuthLoading />;
  }

  if (!hasPendingOtp) {
    return (
      <main className="grid min-h-screen place-items-center bg-white px-6 py-12 text-slate-950">
        <Card className="w-full max-w-md rounded-[8px] border-slate-200 shadow-sm justify-center">
          <CardHeader className="items-center text-center">
            <img
              src={lvLogo}
              width="384"
              height="384"
              alt="ALRM System logo"
              className="mx-auto mb-2 size-20 object-contain"
            />
            <CardTitle className="text-2xl font-black">
              OTP Verification
            </CardTitle>
            <CardDescription>
              Your login session has expired or was already verified.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              type="button"
              onClick={handleBackToLogin}
              className="h-10 w-full rounded-[5px] bg-[#0b4bd3] font-bold text-white hover:bg-[#083da9]"
            >
              Back to Login
            </Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10 text-slate-950">
      <Card className="w-full max-w-[500px] rounded-[8px] border-slate-200 bg-white shadow-sm">
        <CardHeader className="items-center gap-3 text-center">
          <img
            src={lvLogo}
            width="384"
            height="384"
            alt="ALRM System logo"
            className="mx-auto size-20 object-contain"
          />
          <div>
            <CardTitle className="text-3xl font-black tracking-normal">
              OTP Verification
            </CardTitle>
            <CardDescription className="mt-2 text-sm text-slate-600">
              Enter the 6-digit code that was sent to{" "}
              {pendingEmail ? pendingEmail : "your LV email account"}.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="grid gap-5">
          {notice && (
            <Alert className="border-green-200 bg-green-50 text-green-900">
              <CheckCircle2 className="size-4" />
              <AlertTitle>Code Sent</AlertTitle>
              <AlertDescription className="text-green-800">
                {notice}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Verification Needed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form className="grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="otp-code">Verification Code</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="otp-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={handleCodeChange}
                  placeholder="000000"
                  aria-invalid={Boolean(error)}
                  className="h-12 rounded-[5px] border-slate-300 pl-10 text-center text-xl font-bold tracking-[0.45em] shadow-none"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={!canSubmit}
              className="h-11 rounded-[5px] bg-[#0b4bd3] font-bold text-white hover:bg-[#083da9]"
            >
              {verifying && <Spinner className="mr-2" />}
              {verifying ? "Verifying..." : "Verify and Continue"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex-col gap-3 border-0 bg-transparent pt-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleResend}
            disabled={sending || resendSeconds > 0}
            className="h-10 w-full rounded-[5px] border-slate-300 font-bold text-[#0b2f70]"
          >
            {sending && <Spinner className="mr-2" />}
            {sending
              ? "Sending..."
              : resendSeconds > 0
                ? `Resend Code in ${formatCountdown(resendSeconds)}`
                : "Resend Code"}
          </Button>

          <button
            type="button"
            onClick={handleBackToLogin}
            className="text-sm font-semibold text-slate-600 hover:text-slate-950"
          >
            Use a different account
          </button>

          <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500">
            <Mail className="size-3.5" />
            LV email verification is required before dashboard access.
          </p>
          <Link to="/login" className="sr-only">
            Back to login
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}

export default OtpVerification;
