import { useRef, useState } from "react";
import { openEvidence } from "@/api/studentRequests";
import { invalidateResourceCache } from "@/api/resourceCache";
import { createDecisionGate } from "./requestApi";

export default function useRequestReview(request, onReload) {
  const [decide] = useState(createDecisionGate);
  const working = useRef({ sending: false, opening: false });
  const [fresh, setFresh] = useState(null);
  const [sending, setSending] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(status) {
    if (working.current.sending || fresh) return;
    working.current.sending = true;
    setSending(true);
    setError("");
    setMessage("");
    try {
      const result = await decide(request, status);
      invalidateResourceCache((key) => key.startsWith("instructor:dashboard:") || key.startsWith("instructor:reports:") || key.startsWith("instructor:class-records:"));
      setFresh({ ...request, ...result, enrollment: result.enrollment || request.enrollment });
      setMessage("Decision saved.");
      onReload();
    } catch (failure) {
      setError(failure.message || "The decision could not be saved.");
    } finally {
      working.current.sending = false;
      setSending(false);
    }
  }
  async function viewEvidence() {
    if (working.current.opening) return;
    working.current.opening = true;
    setOpening(true);
    setError("");
    try { await openEvidence(encodeURIComponent(request.id)); }
    catch (failure) { setError(failure.message || "The attachment could not be opened."); }
    finally { working.current.opening = false; setOpening(false); }
  }
  return { record: fresh || request, sending, opening, error, message, submit, viewEvidence };
}
