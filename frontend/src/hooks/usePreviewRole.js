import { useSyncExternalStore } from "react";
import { canPreviewRole, getPreviewRole, PREVIEW_ROLE_OPTIONS } from "../lib/previewRole.js";

const CHANGE_EVENT = "alrm:preview-role-changed";

function subscribe(onChange) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function usePreviewRole(user) {
  const role = useSyncExternalStore(
    subscribe,
    () => getPreviewRole(user),
    () => getPreviewRole(user),
  );
  const canPreviewRoles = canPreviewRole(user);

  function setActiveRole(nextRole) {
    if (!canPreviewRoles || !user?.id) return;
    if (!PREVIEW_ROLE_OPTIONS.some((option) => option.value === nextRole)) return;
    try {
      localStorage.setItem(`alrm_preview_role:${user.id}`, nextRole);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // The server role remains available when browser storage is disabled.
    }
  }

  return { activeRole: role, canPreviewRoles, setActiveRole };
}
