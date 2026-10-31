import { TEXT_INPUT_MAX_LENGTH } from "../../../../lib/inputLimits.js";

export const requestOptions = [
  { label: "Student Late Form", value: "late" },
  { label: "Student Absence Form", value: "absence" },
];

export const associateProgram = "Associate in Computer Technology";

export const programOptions = [
  associateProgram,
  "BA in Broadcasting",
  "BS in Accountancy",
  "BS in Accountancy Information Systems",
  "BS in Information Systems",
  "BS in Social Work",
];

export const yearOptions = ["1st year", "2nd year", "3rd year", "4th year"];

export const absenceReasonOptions = [
  "Illness / Medical Condition",
  "Family Emergency",
  "Official School Activity",
  "Personal Reason",
  "Others",
];

export const proofOptions = [
  "Medical Certificate",
  "Prescription / Medical Record",
  "Death Certificate / Funeral Notice",
  "School Activity Endorsement",
  "Letter from Parent/Guardian",
  "Others",
];

export const LAST_STEP = 6;

export const initialForm = {
  requestType: "",
  consent: "",
  studentName: "",
  program: "",
  level: "",
  guardianName: "",
  contactNumber: "",
  dateSubmitted: "",
  minutesLate: "",
  startDateOfAbsence: "",
  endDateOfAbsence: "",
  classId: "",
  classText: "",
  reason: "",
  absenceReasons: [],
  proof_types: [],
  evidenceFile: null,
  declaration: false,
};

export const LIMITS = {
  studentName: 100,
  guardianName: TEXT_INPUT_MAX_LENGTH,
  reason: 100,
  minutesLate: 3, // max na digits (hanggang 999)
};

// CHANGED: 2MB na, dahil nasa database na ang file
export const EVIDENCE = {
  maxBytes: 2 * 1024 * 1024,
  maxInputBytes: 10 * 1024 * 1024,
  maxImagePixels: 20_000_000,
  accept: ".pdf,.jpg,.jpeg,.png",
  mimeTypes: ["application/pdf", "image/jpeg", "image/png"],
  hint: "PDF, JPG, or PNG - max 2MB",
};
