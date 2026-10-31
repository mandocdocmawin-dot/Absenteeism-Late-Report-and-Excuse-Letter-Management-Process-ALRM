import { BellCheck, Loader2 } from "lucide-react";

function formatCountdown(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export default function RecordActions({ record, onView, description, onFollowUp, followingUpId = null, cooldownSeconds = 0 }) {
  const isSending = followingUpId === record.id;
  const countdown = cooldownSeconds > 0 ? formatCountdown(cooldownSeconds) : "";
  const followUpLabel = countdown
    ? `Follow up available in ${countdown}`
    : description ? `Follow up on ${description}` : "Follow up";
  return <div className="flex w-full min-w-0 flex-nowrap items-center justify-start gap-2">
    <button type="button" onClick={() => onView(record)} className="whitespace-nowrap text-xs font-medium text-[#0969FF] hover:underline dark:text-blue-400">
      View Record<span className="sr-only"> for {description}</span>
    </button>
    {record.status === "pending" && <button
      type="button"
      onClick={() => onFollowUp(record)}
      disabled={Boolean(followingUpId) || !onFollowUp || Boolean(countdown)}
      aria-busy={isSending}
      aria-label={followUpLabel}
      title={countdown ? followUpLabel : !onFollowUp ? "Follow-up is unavailable." : undefined}
      className={`inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900 ${countdown ? "gap-1 px-2 text-xs font-semibold" : "w-7"}`}
    >
      {isSending ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <BellCheck aria-hidden="true" className="size-3.5" />}
      {countdown && <span>{countdown}</span>}
    </button>}
  </div>;
}
