import { useEffect, useMemo, useRef, useState } from "react"; 
import { createStudentRequest, getStudentClasses, uploadEvidence } from "@/api/studentRequests";
import { invalidateResourceCache, requestCachedResource } from "@/api/resourceCache";
import { useAuth } from "@/context/AuthContext";
import { getStoredProfileSetup } from "@/lib/profileSetup";
import { buildRequestPayload, proofTypeError } from "./buildPayload";
import { LAST_STEP, LIMITS, initialForm } from "./constants";
import { firstInvalidRequestStep, validateReview, validateStep } from "./validation";
import {
  buildInitialForm,
  profileDefaults,
} from "./utils";

export default function useRequestForm() {
  const { user, refreshUser } = useAuth();
  const storedProfile = useMemo(() => getStoredProfileSetup(user), [user]);
  const [step, setStep] = useState(0);
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reviewEditing, setReviewEditing] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState(() =>
    buildInitialForm(initialForm, user, storedProfile),
  );

  const uploadedRef = useRef(null);
  const classesCacheKey = `student:classes:${user?.id || "unknown"}`;

  useEffect(() => {
    const defaults = profileDefaults(user, storedProfile);

    // Keep identity tied to the saved profile, including after a refresh.
    queueMicrotask(() => setForm((current) => {
      return {
        ...current,
        studentName: defaults.studentName,
        program: defaults.program,
        level: defaults.level,
        guardianName: current.guardianName || defaults.guardianName,
        contactNumber: current.contactNumber || defaults.contactNumber,
      };
    }));
  }, [storedProfile, user]);

  useEffect(() => {
    let alive = true;

    async function loadClasses() {
      setClassesLoading(true);
      setClassesError("");

      try {
        const data = await requestCachedResource(classesCacheKey, () => getStudentClasses());
        if (alive) setClasses(data);
      } catch (loadError) {
        if (alive) {
          setClasses([]);
          setClassesError(loadError?.message || "Unable to load your classes.");
        }
      } finally {
        if (alive) setClassesLoading(false);
      }
    }

    loadClasses();

    return () => {
      alive = false;
    };
  }, [classesCacheKey]);

  function updateField(name, value) {
    if (name === "evidenceFile" && step === LAST_STEP) return;
    if (["studentName", "program", "level"].includes(name)) return;
    if (name === "guardianName" && /\p{N}/u.test(value)) return;
    if (["guardianName", "reason"].includes(name) && value.length > LIMITS[name]) return;
    setForm((current) => {
      if (name !== "requestType") return { ...current, [name]: value };

      return {
        ...current,
        requestType: value,
        minutesLate: "",
        startDateOfAbsence: "",
        endDateOfAbsence: "",
        reason: "",
        classText: "",
        absenceReasons: [],
        proof_types: [],
        evidenceFile: step === LAST_STEP ? current.evidenceFile : null,
        declaration: false,
      };
    });
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setError("");
  }

  function toggleListField(name, value) {
    setForm((current) => {
      const selected = current[name] || [];

      return {
        ...current,
        [name]: selected.includes(value)
          ? selected.filter((item) => item !== value)
          : [...selected, value],
      };
    });
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setError("");
  }

  function handleRadioClick(name, value, event) {
    if (form[name] !== value) return;

    event.preventDefault();
    updateField(name, "");
  }

  function runValidation(currentStep = step) {
    const nextErrors = validateStep({
      step: currentStep,
      form,
      classes,
      classesError,
    });

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function nextStep() {
    if (!runValidation()) return;
    setStep((current) => Math.min(current + 1, LAST_STEP));
  }

  function previousStep() {
    if (submitting) return;
    setReviewEditing(false);
    setFieldErrors({});
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  }

  function startReviewEdit() {
    if (submitting || submitted || step !== LAST_STEP) return;
    setFieldErrors({});
    setError("");
    setForm((current) => ({ ...current, declaration: false }));
    setReviewEditing(true);
  }

  function saveReviewEdit() {
    if (submitting) return;
    const errors = validateReview(form, classes, classesError);
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) setReviewEditing(false);
  }

  async function resolveEvidence() {
    const file = form.evidenceFile;
    if (!file) return null;

    if (uploadedRef.current?.file === file) return uploadedRef.current;

    setUploading(true);
    try {
      const result = await uploadEvidence(file);
      uploadedRef.current = { file, path: result.path, type: result.type };
      return uploadedRef.current;
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    if (reviewEditing) {
      saveReviewEdit();
      return;
    }

    const invalid = firstInvalidRequestStep(form, classes, classesError);
    if (invalid) {
      if (step === LAST_STEP) {
        setFieldErrors({ ...validateReview(form, classes, classesError), ...validateStep({ step: LAST_STEP, form, classes, classesError }) });
        if (invalid.step !== LAST_STEP) setReviewEditing(true);
      } else {
        setStep(invalid.step);
        setFieldErrors(invalid.errors);
      }
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const evidence = await resolveEvidence();
      await createStudentRequest(buildRequestPayload(form, classes, evidence));
      invalidateResourceCache((key) => key.startsWith("student:records:") || key.startsWith("student:requests:") || key.startsWith("student:dashboard:"));
      setSubmitted(true);
      refreshUser({ silent: true }).catch(() => {});
    } catch (submitError) {
      if (submitError?.status === 409) {
        try {
          const refreshedClasses = await requestCachedResource(classesCacheKey, () => getStudentClasses(), { force: true });
          setClasses(refreshedClasses);
          setForm((current) => ({ ...current, classId: "", classText: "", declaration: false }));
          setReviewEditing(true);
          setError("The teaching assignment changed. Review your classes and choose the subject again before submitting.");
        } catch (refreshError) {
          setClasses([]);
          setClassesError(refreshError?.message || "Your updated classes could not be loaded.");
          setError("The teaching assignment changed, but the updated class list could not be loaded. Please try again.");
        }
        return;
      }
      setError(submitError?.message || "Unable to submit your request.");
      const proofError = proofTypeError(submitError?.validationErrors || submitError?.body?.errors);
      if (proofError) {
        setFieldErrors((current) => ({ ...current, proof_types: proofError }));
        if (step === LAST_STEP) setReviewEditing(true);
        else setStep(5);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    const fresh = buildInitialForm(initialForm, user, storedProfile);

    setForm({
      ...fresh,
      guardianName: form.guardianName || fresh.guardianName,
      contactNumber: form.contactNumber || fresh.contactNumber,
    });
    uploadedRef.current = null; 
    setStep(0);
    setError("");
    setFieldErrors({});
    setSubmitted(false);
    setReviewEditing(false);
  }

  return {
    user,
    step,
    form,
    classes,
    classesLoading,
    classesError,
    submitting,
    uploading,
    submitted,
    error,
    fieldErrors,
    updateField,
    toggleListField,
    handleRadioClick,
    nextStep,
    previousStep,
    reviewEditing,
    startReviewEdit,
    saveReviewEdit,
    handleSubmit,
    resetForm,
  };
}
