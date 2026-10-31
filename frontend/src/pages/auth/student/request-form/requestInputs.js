import { assertValidInputs, isIdentifier, isValidDate, isWholeNumber, personNamePattern, sanitizeText, textError } from '../../../../lib/inputValidation.js';
import { proofOptions } from './constants.js';

export function prepareRequestInput(data, partial = false) {
  const payload = { ...data };
  const errors = {};
  if (!partial || Object.hasOwn(data, 'type')) errors.type = ['absence', 'late'].includes(data.type) ? '' : 'Select an available request type.';
  if (!partial) {
    for (const [key, label] of [['class_id', 'Class'], ['teaching_assignment_id', 'Teaching assignment'], ['reason', 'Reason'], ['subjects_missed', 'Subject'], ['guardian_name', "Parent or guardian's name"], ['contact_number', 'Contact number']]) {
      if (!Object.hasOwn(data, key)) errors[key] = `${label} is required.`;
    }
    if (data.type === 'late' && data.minutes_late == null) errors.minutes_late = 'Enter minutes late.';
  }
  if ((!partial || Object.hasOwn(data, 'type')) && !data.start_date_of_absence) errors.start_date_of_absence = data.type === 'late' ? 'Choose the date of tardiness.' : 'Choose the start date of absence.';
  for (const [key, label, max, multiline] of [['reason', 'Reason', data.type === 'absence' ? 600 : 100, true], ['subjects_missed', 'Subject', 255, false], ['guardian_name', "Parent or guardian's name", 50, false]]) {
    if (!Object.hasOwn(data, key)) continue;
    payload[key] = sanitizeText(data[key], { multiline });
    errors[key] = textError(payload[key], label, { min: key === 'guardian_name' ? 2 : 1, max, multiline, ...(key === 'guardian_name' ? { pattern: personNamePattern } : {}) });
  }
  if (Object.hasOwn(data, 'contact_number')) {
    payload.contact_number = sanitizeText(data.contact_number);
    errors.contact_number = /^(09\d{9}|\+639\d{9})$/.test(payload.contact_number) ? '' : 'Enter all 10 digits after +63, starting with 9.';
  }
  for (const key of ['class_id', 'teaching_assignment_id', 'evidence_file_url']) {
    if (data[key] == null && key === 'evidence_file_url') continue;
    if (!Object.hasOwn(data, key)) continue;
    payload[key] = sanitizeText(data[key]);
    errors[key] = isIdentifier(payload[key]) ? '' : `Choose a valid ${key === 'class_id' ? 'class' : key === 'teaching_assignment_id' ? 'teaching assignment' : 'attachment'}.`;
  }
  if (Object.hasOwn(data, 'minutes_late') && data.minutes_late != null) {
    errors.minutes_late = isWholeNumber(data.minutes_late) ? '' : 'Minutes late must be a whole number from 1 to 999.';
    if (!errors.minutes_late) payload.minutes_late = Number(data.minutes_late);
  }
  for (const [key, label] of [['start_date_of_absence', 'start'], ['end_date_of_absence', 'end']]) {
    if (data[key] == null || data[key] === '') continue;
    errors[key] = isValidDate(data[key]) ? '' : `Choose a valid ${label} date.`;
  }
  if (data.start_date_of_absence && data.end_date_of_absence && data.end_date_of_absence < data.start_date_of_absence) errors.end_date_of_absence = 'End date must be the same as or later than the start date.';
  if (Object.hasOwn(data, 'proof_types')) {
    const proofs = data.proof_types;
    errors.proof_types = Array.isArray(proofs) && proofs.length <= proofOptions.length && new Set(proofs).size === proofs.length && proofs.every(proof => proofOptions.includes(proof)) ? '' : 'Select valid, distinct supporting document types.';
  }
  assertValidInputs(errors);
  return payload;
}
