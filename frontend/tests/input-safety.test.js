import assert from 'node:assert/strict';
import { afterEach, test, mock } from 'node:test';
import { mockApiFetch } from './helpers/mockApiFetch.js';
import { createInstructor } from '../src/api/adminUsers.js';
import { createClass, createProgram, updateStaffRole } from '../src/api/admin.js';
import { saveProfileSetup } from '../src/api/profileSetup.js';
import { createStudentRequest, updateStudentRequest } from '../src/api/studentRequests.js';
import { createStudentRequest as createStudentRequestFromDashboardApi } from '../src/api/student.js';
import { generateAdminReport } from '../src/api/adminReports.js';
import { verifyOtp } from '../src/api/otp.js';
import { validateStep } from '../src/pages/auth/student/request-form/validation.js';
import { buildRequestPayload, buildRequestUpdatePayload } from '../src/pages/auth/student/request-form/buildPayload.js';
import { isValidDate, isWholeNumber } from '../src/lib/inputValidation.js';
import { initialForm } from '../src/pages/auth/student/request-form/constants.js';

afterEach(() => mock.restoreAll());

function capture() {
  return mockApiFetch(async () => Response.json({ success: true, data: {} }));
}

const course = { subject_name: 'Data Structures', section: 'BSIS 3', schedule: 'Monday 9 AM', instructor_id: 'instructor-one', program_id: 'program-one', year_level: '3rd', semester: '1st', school_year: '2026-2027' };
const request = { class_id: 'class-one', type: 'late', subjects_missed: 'Data Structures', reason: 'Traffic delay', minutes_late: 5, start_date_of_absence: '2026-10-20', guardian_name: 'Alex Parent', contact_number: '+639123456789' };

test('account submission normalizes Unicode and control characters while preserving real names', async () => {
  const fetch = capture();
  await createInstructor({ fullName: "  Jose\u0301\u0000 O’Neill-Santos  ", email: '  JOSE@LAVERDAD.EDU.PH\u0000 ' });
  assert.deepEqual(JSON.parse(fetch.mock.calls[0].arguments[1].body), { name: 'José O’Neill-Santos', email: 'jose@laverdad.edu.ph', role: 'instructor' });
});

test('invalid account names, emails and overlong fields never reach the network', async () => {
  const fetch = capture();
  for (const form of [{ fullName: '   ', email: 'a@laverdad.edu.ph' }, { fullName: '<script>alert(1)</script>', email: 'a@laverdad.edu.ph' }, { fullName: 'Alex Parent', email: 'not-an-email' }, { fullName: 'A'.repeat(51), email: 'a@laverdad.edu.ph' }]) {
    await assert.rejects(() => createInstructor(form), error => error.status === 422 && Boolean(error.fieldErrors));
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('program and class submissions trim text and reject invalid required values', async () => {
  const fetch = capture();
  await createClass({ ...course, subject_name: '  Data\u0000 Structures  ' });
  assert.equal(JSON.parse(fetch.mock.calls[0].arguments[1].body).subject_name, 'Data Structures');
  await assert.rejects(async () => createProgram({ program_name: ' \u0000 ' }), /Program name/);
  for (const changes of [{ school_year: '2026-2025' }, { semester: 'invalid' }, { year_level: '5th' }, { section: ' ' }]) {
    await assert.rejects(async () => createClass({ ...course, ...changes }), error => error.status === 422);
  }
  assert.equal(fetch.mock.callCount(), 1);
});

test('staff role changes reject values outside the staff role choices', () => {
  const fetch = capture();
  assert.throws(() => updateStaffRole('user-one', 'student'), error => error.status === 422);
  assert.equal(fetch.mock.callCount(), 0);
});

test('profile submission rejects invalid student data and removes unwanted surrounding whitespace', async () => {
  const fetch = capture();
  await saveProfileSetup({ program_id: ' program-one ', school_id_number: ' 24-001 ', year_level: '3rd' });
  assert.deepEqual(JSON.parse(fetch.mock.calls[0].arguments[1].body), { program_id: 'program-one', school_id_number: '24-001', year_level: '3rd' });
  for (const changes of [{ program_id: '../admin' }, { school_id_number: 'A'.repeat(51) }, { year_level: '5th' }]) {
    await assert.rejects(() => saveProfileSetup({ program_id: 'program-one', school_id_number: '24-001', year_level: '3rd', ...changes }), error => error.status === 422);
  }
  assert.equal(fetch.mock.callCount(), 1);
});

test('request validation rejects impossible calendar dates and tampered checkbox selections', () => {
  const form = { ...initialForm, requestType: 'absence', classId: 'class-one', startDateOfAbsence: '2026-02-30', endDateOfAbsence: '2026-03-01', absenceReasons: ['invented reason'] };
  const errors = validateStep({ step: 4, form, classes: [] });
  assert.ok(errors.startDateOfAbsence);
  assert.ok(errors.absenceReasons);
  assert.ok(validateStep({ step: 0, form: { ...form, requestType: 'administrator' } }).requestType);
});

test('request APIs reject malformed numbers, dates and proof selections before sending', async () => {
  const fetch = capture();
  for (const changes of [{ minutes_late: '1e2' }, { minutes_late: -1 }, { minutes_late: 1000 }, { start_date_of_absence: null }, { contact_number: '+638123456789' }, { proof_types: ['not a proof'] }]) {
    await assert.rejects(() => createStudentRequest({ ...request, ...changes }), error => error.status === 422);
  }
  await assert.rejects(() => updateStudentRequest('one', { type: 'absence', reason: 'Illness', start_date_of_absence: '2026-02-30', end_date_of_absence: '2026-03-01' }), error => error.status === 422);
  assert.equal(fetch.mock.callCount(), 0);
});

test('the dashboard API uses the same request validation', async () => {
  const fetch = capture();
  await assert.rejects(() => createStudentRequestFromDashboardApi({ ...request, minutes_late: '1e2' }), error => error.status === 422);
  assert.equal(fetch.mock.callCount(), 0);
});

test('normalization preserves explanation punctuation, newlines and HTML-like text as plain text', () => {
  const payload = buildRequestPayload({ ...initialForm, requestType: 'late', guardianName: ' Alex\u0000 Parent ', contactNumber: '+639123456789', reason: '  Pain < 5 & nausea.\r\nDoctor’s advice.\u0000 ', minutesLate: '5' }, []);
  assert.equal(payload.guardian_name, 'Alex Parent');
  assert.equal(payload.reason, 'Pain < 5 & nausea.\nDoctor’s advice.');
});

test('report filters reject impossible dates, reversed ranges and invalid statuses before fetching', async () => {
  const fetch = capture();
  for (const filters of [{ date_from: '2026-02-30' }, { date_from: '2026-10-20', date_to: '2026-10-01' }, { status: 'attacker' }]) {
    await assert.rejects(() => generateAdminReport(filters), error => error.status === 422);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('OTP verification accepts exactly six ASCII digits and rejects malformed codes locally', async () => {
  const fetch = capture();
  for (const code of ['12345', '1234567', '12345a', '<1234>', '\u0661\u0662\u0663\u0664\u0665\u0666']) {
    await assert.rejects(() => verifyOtp({ code, pending: 'pending-one' }), error => error.status === 422);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('edit payloads validate numeric input before coercion, and numeric helpers reject containers', () => {
  assert.throws(() => buildRequestUpdatePayload({ type: 'late', reason: 'Traffic delay', minutes_late: '1e2' }), /whole number/);
  assert.equal(isWholeNumber([5]), false);
  assert.equal(isWholeNumber({ value: 5 }), false);
  assert.equal(isWholeNumber('15'), true);
});

test('calendar checks accept leap dates without accepting rollover dates or timestamps', () => {
  assert.equal(isValidDate('2024-02-29'), true);
  for (const value of ['2026-02-29', '2026-04-31', '2026-00-01', '2026-10-28T00:00:00Z', '0000-01-01']) assert.equal(isValidDate(value), false, value);
});
