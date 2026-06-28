// backend/utils/bulkValidation.js
// Shared server-side validation helpers for bulk import controllers.
// Re-validates every row even after frontend validation — never trust client data.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;

/**
 * Validate a single student row.
 * Returns an array of error strings (empty = valid).
 */
function validateStudentRow(row) {
  const e = [];
  if (!row.name?.trim())                            e.push('name is required');
  if (!EMAIL_RE.test(row.email || ''))              e.push('invalid email format');
  if (row.phone && !PHONE_RE.test(row.phone))       e.push('phone must be 10 digits (start 6-9)');
  if (!row.roll_number?.trim())                     e.push('roll_number is required');
  if (!row.class_name?.trim())                      e.push('class_name is required');
  const g = row.gender?.toLowerCase();
  if (!['male', 'female', 'other'].includes(g))     e.push('gender must be male, female, or other');
  
  const DATE_RE = /^(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}-\d{2}-\d{2})$/;
  if (!row.date_of_birth)                           e.push('date_of_birth is required (DD/MM/YYYY)');
  else if (!DATE_RE.test(row.date_of_birth))        e.push('invalid date_of_birth format');

  if (row.admission_date && !DATE_RE.test(row.admission_date)) e.push('invalid admission_date format');

  if (row.password && row.password.length < 8)      e.push('password must be at least 8 characters');
  return e;
}

/**
 * Validate a single parent row.
 * Returns an array of error strings (empty = valid).
 */
function validateParentRow(row) {
  const e = [];
  if (!row.name?.trim())                                      e.push('name is required');
  if (!EMAIL_RE.test(row.email || ''))                        e.push('invalid email format');
  if (!row.phone?.trim())                                     e.push('phone is required');
  if (!row.student_roll_number?.trim())                       e.push('student_roll_number is required');
  const r = row.relationship?.toLowerCase();
  if (!['father', 'mother', 'guardian'].includes(r))          e.push('relationship must be father, mother, or guardian');
  if (row.password && row.password.length < 8)                e.push('password must be at least 8 characters');
  return e;
}

/**
 * Validate a single faculty row.
 * Returns an array of error strings (empty = valid).
 */
function validateFacultyRow(row) {
  const e = [];
  if (!row.name?.trim())                          e.push('name is required');
  if (!EMAIL_RE.test(row.email || ''))            e.push('invalid email format');
  if (!row.phone?.trim())                         e.push('phone is required');
  if (row.address && row.address.length > 500)    e.push('address must be at most 500 characters');
  if (row.password && row.password.length < 8)    e.push('password must be at least 8 characters');
  return e;
}

/**
 * Convert Excel DD/MM/YYYY or DD-MM-YYYY string to standard YYYY-MM-DD
 */
function parseExcelDate(dateStr) {
  if (!dateStr) return null;
  
  if (typeof dateStr === 'string') {
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) return dateStr.substring(0, 10);
    
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
  }
  
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  
  return null;
}

module.exports = { validateStudentRow, validateParentRow, validateFacultyRow, parseExcelDate };
