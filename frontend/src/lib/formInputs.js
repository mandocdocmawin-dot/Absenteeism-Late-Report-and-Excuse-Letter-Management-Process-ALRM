import { assertValidInputs, emailPattern, isIdentifier, isValidDate, personNamePattern, sanitizeText, textError } from './inputValidation.js';

const yearLevels = ['1st', '2nd', '3rd', '4th'];

export function prepareAccountInput(data) {
  const payload = {
    first_name: sanitizeText(data.first_name),
    middle_name: sanitizeText(data.middle_name) || null,
    last_name: sanitizeText(data.last_name),
    email: sanitizeText(data.email).toLowerCase(),
    role: data.role,
    school_id_number: sanitizeText(data.school_id_number),
  };
  if (data.role !== 'administrator') payload.program_id = sanitizeText(data.program_id);
  assertValidInputs({
    first_name: textError(payload.first_name, 'First name', { min: 1, pattern: personNamePattern }),
    middle_name: payload.middle_name ? textError(payload.middle_name, 'Middle name', { min: 1, pattern: personNamePattern }) : '',
    last_name: textError(payload.last_name, 'Last name', { min: 1, pattern: personNamePattern }),
    email: textError(payload.email, 'Email address', { pattern: emailPattern }),
    role: ['student', 'instructor', 'program_head', 'administrator'].includes(data.role) ? '' : 'Select an available role.',
    program_id: data.role === 'administrator' || isIdentifier(payload.program_id) ? '' : 'Select a valid program.',
    school_id_number: textError(payload.school_id_number, 'User ID', { pattern: /^[\p{L}\p{N}][\p{L}\p{N} ._/-]*$/u }),
  });
  return payload;
}

export function prepareProfileInput(data) {
  const payload = {};
  const errors = {};
  if (Object.hasOwn(data, 'program_id')) {
    payload.program_id = sanitizeText(data.program_id);
    errors.program_id = isIdentifier(payload.program_id) ? '' : 'Select a valid program.';
  }
  if (Object.hasOwn(data, 'school_id_number')) {
    payload.school_id_number = sanitizeText(data.school_id_number);
    errors.school_id_number = textError(payload.school_id_number, 'School ID number', { pattern: /^[\p{L}\p{N}][\p{L}\p{N} ._/-]*$/u });
  }
  if (Object.hasOwn(data, 'year_level')) {
    payload.year_level = data.year_level;
    errors.year_level = yearLevels.includes(data.year_level) ? '' : 'Select an available year level.';
  }
  // A profile form cannot assign its own role or account status.
  if (Object.hasOwn(data, 'role') || Object.hasOwn(data, 'status')) errors.role = 'Account role and status cannot be changed here.';
  assertValidInputs(errors);
  return payload;
}

export function prepareProgramInput(data, partial = false) {
  const payload = {};
  const errors = {};
  if (!partial || Object.hasOwn(data, 'program_name')) {
    payload.program_name = sanitizeText(data.program_name);
    errors.program_name = textError(payload.program_name, 'Program name');
  }
  if (Object.hasOwn(data, 'program_head_id')) {
    payload.program_head_id = data.program_head_id ? sanitizeText(data.program_head_id) : null;
    errors.program_head_id = payload.program_head_id === null || isIdentifier(payload.program_head_id) ? '' : 'Select a valid program head.';
  }
  assertValidInputs(errors);
  return payload;
}

export function prepareClassInput(data, partial = false) {
  const payload = {};
  const errors = {};
  for (const [key, label] of [['subject_name', 'Subject'], ['section', 'Section']]) {
    if (partial && !Object.hasOwn(data, key)) continue;
    payload[key] = sanitizeText(data[key]);
    errors[key] = textError(payload[key], label);
  }
  for (const [key, label] of [['program_id', 'program'], ['curriculum_subject_id', 'curriculum subject']]) {
    if (partial && !Object.hasOwn(data, key)) continue;
    payload[key] = sanitizeText(data[key]);
    errors[key] = isIdentifier(payload[key]) ? '' : `Select a valid ${label}.`;
  }
  for (const [key, choices] of [['semester', ['1st', '2nd']], ['year_level', yearLevels]]) {
    if (partial && !Object.hasOwn(data, key)) continue;
    payload[key] = data[key];
    errors[key] = choices.includes(data[key]) ? '' : `Select an available ${key === 'semester' ? 'semester' : 'year level'}.`;
  }
  if (!partial || Object.hasOwn(data, 'school_year')) {
    payload.school_year = sanitizeText(data.school_year);
    const match = /^(\d{4})-(\d{4})$/.exec(payload.school_year);
    errors.school_year = match && Number(match[2]) === Number(match[1]) + 1 ? '' : 'Enter consecutive school years, for example 2026-2027.';
  }
  if (!partial || Object.hasOwn(data, 'schedule')) {
    payload.schedule = Array.isArray(data.schedule) ? data.schedule.map((meeting) => ({
      day: sanitizeText(meeting.day),
      start: sanitizeText(meeting.start),
      end: sanitizeText(meeting.end),
      room: sanitizeText(meeting.room) || null,
    })) : [];
    const invalidMeeting = payload.schedule.find((meeting) => !['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(meeting.day)
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(meeting.start)
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(meeting.end)
      || meeting.end <= meeting.start);
    errors.schedule = invalidMeeting ? 'Complete each meeting with a valid day and an end time after its start.' : '';
  }
  if (payload.schedule?.length === 0) {
    payload.weekly_hours = Number(data.weekly_hours);
    payload.meetings_per_week = Number(data.meetings_per_week);
    errors.weekly_hours = Number.isFinite(payload.weekly_hours) && payload.weekly_hours > 0 && payload.weekly_hours <= 168 ? '' : 'Enter confirmed weekly contact hours.';
    errors.meetings_per_week = Number.isInteger(payload.meetings_per_week) && payload.meetings_per_week >= 1 && payload.meetings_per_week <= 42 ? '' : 'Enter the confirmed meetings per week.';
  }
  assertValidInputs(errors);
  return payload;
}

export function prepareReportFilters(filters) {
  const payload = { ...filters };
  const errors = {};
  for (const key of ['program_id', 'status', 'date_from', 'date_to']) {
    if (Object.hasOwn(payload, key)) payload[key] = sanitizeText(payload[key]);
  }
  if (payload.program_id && !isIdentifier(payload.program_id)) errors.program_id = 'Select a valid program.';
  if (payload.status && !['pending', 'approved', 'noted', 'invalid'].includes(payload.status)) errors.status = 'Select an available request status.';
  for (const [key, label] of [['date_from', 'start'], ['date_to', 'end']]) {
    if (payload[key] && !isValidDate(payload[key])) errors[key] = `Choose a valid ${label} date.`;
  }
  if (payload.date_from && payload.date_to && payload.date_from > payload.date_to) errors.date_to = 'The end date must be on or after the start date.';
  assertValidInputs(errors);
  return payload;
}
