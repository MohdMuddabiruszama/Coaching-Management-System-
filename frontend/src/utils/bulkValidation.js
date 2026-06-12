// frontend/src/utils/bulkValidation.js
// Client-side validation for bulk import (Approach A — SheetJS parse).
// Runs in the browser for INSTANT feedback before any API call is made.
// Backend still re-validates everything — this is purely for UX.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;

// ── Student row validator ────────────────────────────────────────────────────
function validateStudentRow(row, seenEmails, seenRolls) {
  const e = [];
  if (!row.name?.trim())                                    e.push('name required');
  if (!EMAIL_RE.test(row.email || ''))                      e.push('invalid email');
  else if (seenEmails.has(row.email.toLowerCase()))         e.push('duplicate email in file');
  else                                                      seenEmails.add(row.email.toLowerCase());
  if (row.phone && !PHONE_RE.test(row.phone))               e.push('phone must be 10 digits (start 6-9)');
  if (!row.roll_number?.trim())                             e.push('roll_number required');
  else if (seenRolls.has(row.roll_number.trim()))           e.push('duplicate roll_number in file');
  else                                                      seenRolls.add(row.roll_number.trim());
  if (!row.class_name?.trim())                              e.push('class_name required');
  if (!row.section?.trim())                                 e.push('section required (use N/A if none)');
  
  const isFull = row.is_full_course?.toString().toLowerCase().trim();
  if (isFull && !['yes', 'no', 'true', 'false', '1', '0'].includes(isFull)) e.push('is_full_course must be Yes or No');
  if (isFull && ['no', 'false', '0'].includes(isFull) && !row.subjects?.trim()) e.push('subjects required if not full course');

  const g = row.gender?.toLowerCase();
  if (!['male', 'female', 'other'].includes(g))             e.push('gender: male, female, or other');
  
  const DATE_RE = /^(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}-\d{2}-\d{2})$/;
  if (!row.date_of_birth)                                   e.push('date_of_birth required (DD/MM/YYYY)');
  else if (!DATE_RE.test(row.date_of_birth))                e.push('invalid date_of_birth format');
  
  if (row.admission_date && !DATE_RE.test(row.admission_date)) e.push('invalid admission_date format');

  if (row.password && row.password.length < 8)              e.push('password min 8 characters');
  return e;
}

// ── Parent row validator ─────────────────────────────────────────────────────
function validateParentRow(row, seenEmails) {
  const e = [];
  if (!row.name?.trim())                                    e.push('name required');
  if (!EMAIL_RE.test(row.email || ''))                      e.push('invalid email');
  else if (seenEmails.has(row.email.toLowerCase()))         e.push('duplicate email in file');
  else                                                      seenEmails.add(row.email.toLowerCase());
  if (!row.phone?.trim())                                   e.push('phone required');
  if (!row.student_roll_number?.trim())                     e.push('student_roll_number required');
  const r = row.relationship?.toLowerCase();
  if (!['father', 'mother', 'guardian'].includes(r))        e.push('relationship: father, mother, or guardian');
  if (row.password && row.password.length < 8)              e.push('password min 8 characters');
  return e;
}

// ── Faculty row validator ────────────────────────────────────────────────────
function validateFacultyRow(row, seenEmails) {
  const e = [];
  if (!row.name?.trim())                                    e.push('name required');
  if (!EMAIL_RE.test(row.email || ''))                      e.push('invalid email');
  else if (seenEmails.has(row.email.toLowerCase()))         e.push('duplicate email in file');
  else                                                      seenEmails.add(row.email.toLowerCase());
  if (!row.phone?.trim())                                   e.push('phone required');
  if (row.salary && isNaN(Number(row.salary)))              e.push('salary must be a number');
  if (row.salary && Number(row.salary) < 0)                 e.push('salary must be positive');
  if (row.password && row.password.length < 8)              e.push('password min 8 characters');
  return e;
}

// ── Master validator ─────────────────────────────────────────────────────────
// Returns { validRows: Row[], errorRows: { rowNum, data, errors[] }[] }
export function validateRows(rawRows, type) {
  const seenEmails = new Set();
  const seenRolls  = new Set();
  const validRows  = [];
  const errorRows  = [];

  rawRows.forEach((row, i) => {
    let errs = [];
    if      (type === 'students') errs = validateStudentRow(row, seenEmails, seenRolls);
    else if (type === 'parents')  errs = validateParentRow(row, seenEmails);
    else if (type === 'faculty')  errs = validateFacultyRow(row, seenEmails);

    if (errs.length) errorRows.push({ rowNum: i + 2, data: row, errors: errs });
    else             validRows.push(row);
  });

  return { validRows, errorRows };
}
