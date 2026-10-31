import { AuthProvider as CookieAuthProvider, useAuth } from "../context/AuthContext";
import { AuthContext } from "./useAuth";

function LegacyAuthContext({ children }) {
  const auth = useAuth();
  return <AuthContext.Provider value={{ ...auth, error: auth.sessionError }}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }) {
  return <CookieAuthProvider><LegacyAuthContext>{children}</LegacyAuthContext></CookieAuthProvider>;
}
