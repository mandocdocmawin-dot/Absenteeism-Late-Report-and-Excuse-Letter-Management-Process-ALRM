import { useEffect, useRef, useState } from "react";
import { followUpStudentRequest } from "@/api/studentRequests";

const FOLLOW_UP_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function followUpCooldownExpiresAt(flaggedDate, now = Date.now()) {
  const sentAt = Date.parse(flaggedDate);
  return (Number.isFinite(sentAt) ? sentAt : now) + FOLLOW_UP_COOLDOWN_MS;
}

function storageKey(userId) {
  return userId ? `alrm_follow_up_cooldowns:${userId}` : null;
}

function readCooldowns(userId, now = Date.now()) {
  const key = storageKey(userId);
  if (!key) return {};
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "{}");
    return Object.fromEntries(Object.entries(stored).filter(([, expiry]) => Number.isFinite(expiry) && expiry > now));
  } catch {
    return {};
  }
}

function writeCooldowns(userId, cooldowns) {
  const key = storageKey(userId);
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(cooldowns)); } catch { /* Browser storage is optional. */ }
}

export default function useRequestFollowUp(userId) {
  const [followingUpId, setFollowingUpId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [cooldownUntil, setCooldownUntil] = useState(() => readCooldowns(userId));
  const [now, setNow] = useState(() => Date.now());
  const requestRef = useRef(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  const hasActiveCooldown = Object.values(cooldownUntil).some((expiry) => expiry > now);
  useEffect(() => {
    if (!hasActiveCooldown) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasActiveCooldown]);

  const cooldownSecondsById = Object.fromEntries(
    Object.entries(cooldownUntil).map(([requestId, expiry]) => [requestId, Math.max(0, Math.ceil((expiry - now) / 1000))]),
  );

  async function followUp(record) {
    if (record?.status !== "pending" || !record.id || requestRef.current || cooldownSecondsById[record.id] > 0) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setFollowingUpId(record.id);
    setNotice(null);
    try {
      const body = await followUpStudentRequest(record.id, { signal: controller.signal });
      if (!controller.signal.aborted) {
        const nextCooldowns = {
          ...cooldownUntil,
          [record.id]: followUpCooldownExpiresAt(body.data?.flagged_date),
        };
        setCooldownUntil(nextCooldowns);
        setNow(Date.now());
        writeCooldowns(userId, nextCooldowns);
        setNotice({ type: "success", message: typeof body.message === "string" ? body.message : "Follow-up sent to your instructor." });
      }
    } catch (issue) {
      if (!controller.signal.aborted) setNotice({ type: "error", message: issue.message || "Unable to send your follow-up." });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (!controller.signal.aborted) setFollowingUpId(null);
    }
  }

  return { followingUpId, cooldownSecondsById, notice, followUp, dismissNotice: () => setNotice(null) };
}
