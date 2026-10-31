import { associateProgram, programOptions, yearOptions } from "./constants.js";

export function today() {
  return new Date().toISOString().slice(0, 10);
}

// NEW: "13:30:00" -> "1:30 PM"
function formatTime(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return String(value || "");

  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";

  return `${hour % 12 || 12}:${match[2]} ${suffix}`;
}

// NEW: isang schedule slot (object o string) -> "Mon 1:30 PM-3:00 PM"
function formatScheduleEntry(entry) {
  if (entry == null) return "";
  if (typeof entry === "string") return entry;

  const day = entry.day ?? entry.day_of_week ?? entry.weekday ?? "";
  const start = entry.start_time ?? entry.start ?? entry.time_start ?? entry.from ?? "";
  const end = entry.end_time ?? entry.end ?? entry.time_end ?? entry.to ?? "";
  const time =
    start && end
      ? `${formatTime(start)}-${formatTime(end)}`
      : formatTime(start || end);

  return [day, time].filter(Boolean).join(" ");
}

// NEW: string, object, o array ng objects -> readable text
export function formatSchedule(schedule) {
  if (!schedule) return "";
  if (typeof schedule === "string") return schedule;

  const entries = Array.isArray(schedule) ? schedule : [schedule];

  return entries.map(formatScheduleEntry).filter(Boolean).join(", ");
}

export function classLabel(item) {
  const instructor = item?.instructor?.name ? ` - ${item.instructor.name}` : "";

  return `${item?.subject_name || "Unnamed Class"}${instructor}`;
}

export function findClassByText(classes, text) {
  const normalizedText = String(text || "").trim().toLowerCase();

  if (!normalizedText) return null;

  return classes.find((item) => {
    const label = classLabel(item).toLowerCase();
    const subject = String(item?.subject_name || "").toLowerCase();

    return label === normalizedText || subject === normalizedText;
  });
}

export function requestTitle(type) {
  return type === "absence" ? "Student Absence Form" : "Student Late Form";
}

export function flowSteps(requestType) {
  return [
    "Request",
    "Instructions",
    "Privacy",
    "Student Info",
    requestType === "absence" ? "Absence Details" : "Late Details",
    "Attachment",
    "Review",
  ];
}

export function phoneDigits(value) {
  const raw = String(value || "").trim();
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+63") || (digits.length > 10 && digits.startsWith("63"))) {
    digits = digits.slice(2);
  } else if (digits.length > 10 && digits.startsWith("09")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

export function normalizePhoneInput(value) {
  const digits = phoneDigits(value);
  return digits ? `+63${digits}` : "";
}

export function yearOptionsForProgram(program) {
  return program === associateProgram ? yearOptions.slice(0, 2) : yearOptions;
}

export function controlClass(hasError, className = "") {
  return [
    className,
    "border-[1.5px] bg-[#FBFBFD] transition-colors focus-visible:border-[#101C4A] focus-visible:ring-[#101C4A]/15",
    hasError
      ? "border-red-500 ring-2 ring-red-100 focus-visible:border-red-500 focus-visible:ring-red-100"
      : "border-slate-200",
  ]
    .filter(Boolean)
    .join(" ");
}

// "Bachelor of Science in Information System" -> "informationsystem"
function normalizeProgram(value) {
  return String(value || "")
    .toLowerCase()
    .replace(
      /^(bachelor of science in|bachelor of arts in|bachelor of|associate in|bs in|ba in|ab in|bs|ba|ab)\s+/,
      "",
    )
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .map((word) => word.replace(/s$/, ""))
    .join("");
}

export function matchProgram(stored) {
  const target = normalizeProgram(stored);
  if (!target) return "";

  return (
    programOptions.find((option) => normalizeProgram(option) === target) || String(stored).trim()
  );
}

// "3rd" / "3rd Year" -> "3rd year" (option ng form)
export function matchYearLevel(stored, program = "") {
  const digit = String(stored || "").match(/\d/)?.[0];
  if (!digit) return "";

  const allowed = program ? yearOptionsForProgram(program) : yearOptions;
  return allowed.find((option) => option.startsWith(digit)) || "";
}

export function profileDefaults(user, storedProfile) {
  const program = matchProgram(storedProfile?.program_name);

  return {
    studentName: user?.name || "",
    program,
    level: matchYearLevel(storedProfile?.year_level, program),
    guardianName: user?.guardian_name || "",
    contactNumber: normalizePhoneInput(user?.contact_number),
  };
}

export function buildInitialForm(initialForm, user, storedProfile) {
  return {
    ...initialForm,
    ...profileDefaults(user, storedProfile),
    dateSubmitted: today(),
  };
}
