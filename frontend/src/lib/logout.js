export async function logoutToSignedOut(logout, navigate) {
  // Local cleanup is immediate; do not flash the login page while token revocation finishes.
  const pendingLogout = logout({ redirectToSignedOut: true });
  navigate("/signed-out", { replace: true });
  await pendingLogout;
}
