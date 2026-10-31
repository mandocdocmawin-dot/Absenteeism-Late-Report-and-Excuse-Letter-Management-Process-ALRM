import { TEXT_INPUT_MAX_LENGTH } from './inputLimits.js';

export function sanitizeText(value, { multiline = false } = {}) {
  if (typeof value !== 'string') return '';
  // Keep legitimate Unicode, punctuation and explanation text; rendering escapes it.
  // eslint-disable-next-line no-control-regex
  const clean = value.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
  return (multiline ? clean : clean.replace(/\s+/gu, ' ')).trim();
}

export function textError(value, label, { min = 1, max = TEXT_INPUT_MAX_LENGTH, pattern, multiline = false } = {}) {
  const clean = sanitizeText(value, { multiline });
  if (!clean || clean.length < min) return `${label} is required${min > 1 ? ` (at least ${min} characters)` : ''}.`;
  if (clean.length > max) return `${label} must not exceed ${max} characters.`;
  if (pattern && !pattern.test(clean)) return `Enter a valid ${label.toLowerCase()}.`;
  return '';
}

export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isIdentifier(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
}

export function isWholeNumber(value, min = 1, max = 999) {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max;
}

export function assertValidInputs(errors) {
  const entries = Object.entries(errors).filter(([, message]) => Boolean(message));
  if (!entries.length) return;
  const error = new Error(entries[0][1]);
  error.status = 422;
  error.fieldErrors = Object.fromEntries(entries.map(([key, message]) => [key, [message]]));
  error.validationErrors = error.fieldErrors;
  error.errors = error.fieldErrors;
  throw error;
}

export const personNamePattern = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;
export const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
