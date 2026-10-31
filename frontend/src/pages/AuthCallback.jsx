import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getPostLoginPath } from "../api/authSecurity";
import { exchangeOtpCode } from "../api/otp";
import { clearCallbackCredentials } from "../api/client";
import { useAuth } from "../context/AuthContext";
import AuthLoading from "@/components/loading/AuthLoading";

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { completeCookieLogin } = useAuth();
  const [error, setError] = useState(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    clearCallbackCredentials();

    async function completeLogin() {
      try {
        if (searchParams.get("error")) {
          throw new Error("Login failed. Please use your official LV email account.");
        }

        const code = searchParams.get("code") || searchParams.get("exchange_code");
        if (!code) throw new Error("Missing one-time sign-in code. Please sign in again.");
        const response = await exchangeOtpCode(code);
        const user = await completeCookieLogin(response);
        navigate(getPostLoginPath(user), { replace: true });
      } catch (loginError) {
        setError(loginError.message || "Login failed. Please try again.");
      }
    }

    completeLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
        <div className="grid gap-4">
          <p role="alert">{error}</p>
          <a className="font-semibold text-primary" href="/login">Back to login</a>
        </div>
      </div>
    );
  }

  return <AuthLoading />;
}
