import { useRef, useState } from "react";
import { BellRing } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import useNotificationPreferences from "@/hooks/useNotificationPreferences";
import { saveEmailNotificationPreference } from "@/api/notifications";

export default function NotificationPreferences({ user, userId = user?.id, role = "student", onEmailSaved }) {
  const student = role === "student";
  const prefix = student ? "student" : "notification";
  const { preferences, updatePreference, error } = useNotificationPreferences(userId, role);
  const emailAvailable = typeof user?.email_notifications_enabled === "boolean";
  const [emailEnabled, setEmailEnabled] = useState(user?.email_notifications_enabled === true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");
  const emailSave = useRef({ active: false, desired: emailEnabled, confirmed: emailEnabled });

  async function changeEmailPreference(checked) {
    if (!emailAvailable || !userId) return;
    setEmailEnabled(checked);
    setEmailError("");
    const save = emailSave.current;
    save.desired = checked;
    if (save.active) return;
    save.active = true;
    setSavingEmail(true);
    try {
      while (true) {
        const requested = save.desired;
        try {
          save.confirmed = await saveEmailNotificationPreference(requested);
        } catch (saveError) {
          if (save.desired !== requested) continue;
          setEmailEnabled(save.confirmed);
          setEmailError(saveError.name === "TimeoutError" || saveError.name === "AbortError"
            ? "The save timed out. Please try again or reload to check your saved preference."
            : saveError.message || "Email notification preference could not be saved.");
          break;
        }
        if (save.desired !== requested) continue;
        setEmailEnabled(save.confirmed);
        onEmailSaved?.();
        break;
      }
    } finally {
      save.active = false;
      setSavingEmail(false);
    }
  }

  const options = [
    { key: "requestUpdates", label: student ? "Excuse letter status updates" : "Request activity updates", description: student ? "Get notified immediately when an instructor approves, denies, or notes your excuse letter." : "Show class requests, instructor decisions, and follow-up notifications." },
    { key: "thresholdAlerts", label: student ? "Threshold warning alerts" : "Attendance threshold alerts", description: student ? "Receive alerts when approaching the 20% absence threshold limit in any enrolled subject." : "Show attendance warnings and incident report notifications for your classes or program." },
    { key: "email", label: "Email notifications", description: student ? "Send copies of official portal notifications and clinic clearances to your registered email." : "Send copies of official portal notifications to your registered email." },
  ];
  return <section aria-labelledby={`${prefix}-preferences-title`} className="pl-0 pr-3 pb-8 pt-[50px] sm:pl-8 sm:pr-12">
    <div className="flex items-start gap-[7px]">
      <BellRing className="mt-[9px] h-[18px] w-5 shrink-0 translate-x-px text-[#3186ff]" strokeWidth={1.75} aria-hidden="true" />
      <div className="relative left-px"><h2 id={`${prefix}-preferences-title`} className="relative -top-px text-[14px] font-medium leading-5 text-[#171717]">Notification Preferences</h2><p className="text-[12.35px] font-normal leading-[18px] text-[#464646]">{student ? "Choose which attendance alerts and excuse request decisions you want to receive." : "Choose which attendance alerts and request updates you want to receive."}</p></div>
    </div>
    <div className="mt-2.5 grid gap-[15px] pl-[26px]">
      {options.map(option => <div key={option.key} className="flex min-h-9 items-center justify-between gap-4">
        <div className="min-w-0"><label htmlFor={`${prefix}-preference-${option.key}`} className={`block text-[13.45px] font-medium leading-[18px] text-[#171717] ${option.key === "email" && !emailAvailable ? "" : "cursor-pointer"}`}>{option.label}</label><p id={`${prefix}-preference-${option.key}-description`} className="text-[12.35px] font-normal leading-[18px] text-[#464646]">{option.description}</p></div>
        <Switch id={`${prefix}-preference-${option.key}`} checked={option.key === "email" ? emailEnabled : (preferences[option.key] ?? false)} disabled={!userId || (option.key === "email" && !emailAvailable)} onCheckedChange={checked => option.key === "email" ? changeEmailPreference(checked) : updatePreference(option.key, checked)} aria-label={option.label} aria-busy={option.key === "email" && savingEmail} aria-describedby={`${prefix}-preference-${option.key}-description${option.key === "email" && !emailAvailable ? ` ${prefix}-email-help` : ""}`} title={option.key === "email" && !emailAvailable ? "Email preferences are not available from the server yet." : undefined} className="cursor-pointer p-px data-[size=default]:h-[18px] data-[size=default]:w-8 data-checked:bg-[#173568] data-unchecked:bg-[#b5b5b5] data-disabled:opacity-100 [&>[data-slot=switch-thumb]]:size-3.5! [&>[data-slot=switch-thumb][data-checked]]:translate-x-3.5!" />
      </div>)}
      {!emailAvailable && <p id={`${prefix}-email-help`} className="sr-only">Email preferences are not available from the server yet.</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {emailError && <p role="alert" className="text-sm text-red-600">{emailError}</p>}
    </div>
  </section>;
}
