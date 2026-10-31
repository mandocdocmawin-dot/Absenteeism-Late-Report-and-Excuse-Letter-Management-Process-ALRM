export function applyLightAppearance(root, browser) {
  root.classList.remove("dark");
  root.style.colorScheme = "light";
  try {
    browser.localStorage.removeItem("alrm-theme");
  } catch {
    // Theme cleanup must not block startup when site storage is unavailable.
  }
}
