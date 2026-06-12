// backend/controllers/bulkImport/bulkStudents.controller.js
// Handles POST /api/students/bulk-import
// Flow: plan limit check → load classes → batch email/roll uniqueness check
//       → row-by-row validation → DB transaction insert → log → respond

const bcrypt = require('bcrypt');
const {
  User, Student, Class, Institute, BulkImportLog, sequelize,
  Subject, StudentClass, StudentSubject
} = require('../../models');
const { validateStudentRow, parseExcelDate } = require('../../utils/bulkValidation');

exports.bulkImportStudents = async (req, res) => {
  try {
    const { rows } = req.body;
    const institute_id = req.user.institute_id;

    // Guard: rows must be an array
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.json({ success: true, inserted: 0, failed: 0, errors: [] });
    }

    // ── 1. Guard: max rows per batch ─────────────────────────────────────────
    if (rows.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 500 rows per import. Please split your file.',
      });
    }

    const errors = [];
    const validRows = [];

    // ── 2. Plan limit check ──────────────────────────────────────────────────
    const inst = await Institute.findByPk(institute_id, {
      attributes: ['current_limit_students'],
    });
    if (inst && inst.current_limit_students != null) {
      const existingCount = await Student.count({ where: { institute_id } });
      const slotsLeft = inst.current_limit_students - existingCount;
      if (rows.length > slotsLeft) {
        return res.status(400).json({
          success: false,
          message: `Plan limit: only ${slotsLeft} student slot(s) remaining. Your file has ${rows.length} rows. Please upgrade or split the import.`,
        });
      }
    }

    // ── 3. Load all classes and subjects once for O(1) lookup ────────────────
    const classes = await Class.findAll({
      where: { institute_id },
      attributes: ['id', 'name', 'section'],
    });

    const allSubjects = await Subject.findAll({
      where: { institute_id },
      attributes: ['id', 'name', 'class_id'],
    });
    const subjectMap = {};
    allSubjects.forEach(s => {
      const key = `${s.class_id}-${s.name.toLowerCase().trim()}`;
      subjectMap[key] = s.id;
    });

    // ── 4. Batch email existence check ───────────────────────────────────────
    const incomingEmails = rows
      .map(r => r.email?.toLowerCase().trim())
      .filter(Boolean);
    const existingUsers = await User.findAll({
      where: { email: incomingEmails },
      attributes: ['email'],
    });
    const takenEmails = new Set(existingUsers.map(u => u.email));
    const seenInBatch = new Set();

    // ── 5. Batch roll_number uniqueness check ────────────────────────────────
    const incomingRolls = rows
      .map(r => r.roll_number?.trim())
      .filter(Boolean);
    const existingRolls = await Student.findAll({
      where: { institute_id, roll_number: incomingRolls },
      attributes: ['roll_number'],
    });
    const takenRolls = new Set(existingRolls.map(s => s.roll_number));
    const seenRollsInBatch = new Set();

    // ── 6. Validate each row ─────────────────────────────────────────────────
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // row 1 = header in Excel
      const rowErrors = validateStudentRow(row);

      const email = row.email?.toLowerCase().trim();
      if (email) {
        if (takenEmails.has(email))   rowErrors.push('email already exists in system');
        if (seenInBatch.has(email))   rowErrors.push('duplicate email within file');
        else                          seenInBatch.add(email);
      }

      const roll = row.roll_number?.trim();
      if (roll) {
        if (takenRolls.has(roll))          rowErrors.push('roll number already exists in institute');
        if (seenRollsInBatch.has(roll))    rowErrors.push('duplicate roll number within file');
        else                               seenRollsInBatch.add(roll);
      }

      // Flexible matching for class and section
      const rName = (row.class_name || '').toString().toLowerCase().replace(/\s+/g, ' ').trim();
      const rSecRaw = (row.section || '').toString().toLowerCase().replace(/\s+/g, ' ').trim();
      const rSec = rSecRaw.replace(/^section\s+/i, '').trim(); 
      
      let class_id = null;
      for (const c of classes) {
          const cName = (c.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
          const cSecRaw = (c.section || '').toLowerCase().replace(/\s+/g, ' ').trim();
          const cSec = cSecRaw.replace(/^section\s+/i, '').trim(); 
          
          if (cName === rName && cSec === rSec) {
              class_id = c.id; break;
          }
          const combinedDb1 = `${cName} - section ${cSec}`;
          const combinedDb2 = `${cName} section ${cSec}`;
          const combinedDb3 = `${cName} - ${cSec}`;
          const combinedDb4 = `${cName} ${cSec}`;
          
          if (!rSec && (rName === combinedDb1 || rName === combinedDb2 || rName === combinedDb3 || rName === combinedDb4 || rName === cName)) {
              class_id = c.id; break;
          }
          
          const combinedExcel1 = rSec ? `${rName} - section ${rSec}` : rName;
          const combinedExcel2 = rSec ? `${rName} section ${rSec}` : rName;
          const combinedExcel3 = rSec ? `${rName} - ${rSec}` : rName;
          const combinedExcel4 = rSec ? `${rName} ${rSec}` : rName;
          
          if (!cSec && (cName === combinedExcel1 || cName === combinedExcel2 || cName === combinedExcel3 || cName === combinedExcel4)) {
              class_id = c.id; break;
          }
      }

      if (!class_id) rowErrors.push(`class '${row.class_name}' section '${row.section || ''}' not found in institute`);

      let subjectIdsToAssign = [];
      const isFullCourse = ['yes', 'true', '1'].includes((row.is_full_course || '').toString().toLowerCase().trim());
      
      if (class_id && !isFullCourse && row.subjects) {
          const subNames = row.subjects.split(',').map(s => s.toLowerCase().trim()).filter(Boolean);
          for (let sName of subNames) {
              const subId = subjectMap[`${class_id}-${sName}`];
              if (subId) {
                  subjectIdsToAssign.push(subId);
              } else {
                  rowErrors.push(`subject '${sName}' not found for this class`);
              }
          }
      }

      if (rowErrors.length) {
        errors.push({ row: rowNum, name: row.name || '', errors: rowErrors });
      } else {
        validRows.push({ ...row, email, class_id, isFullCourse, subjectIdsToAssign });
      }
    }

    // ── 7. Insert all valid rows in a single DB transaction (Optimized Bulk Insert) ──────────────────
    const t = await sequelize.transaction();
    const emailsToDispatch = [];
    const { generateTempPassword } = require('../../utils/passwordGenerator');
    const { sendStudentWelcomeEmail } = require('../../services/email.service');
    let instituteName = "Your Institute";
    try {
      const institute = await Institute.findByPk(institute_id);
      if (institute) instituteName = institute.name;
    } catch(e) {}

    try {
        const userPayloads = [];
        const validRowsWithPw = [];
        for (const r of validRows) {
            const pw = generateTempPassword();
            const temp_password_expires_at = new Date();
            temp_password_expires_at.setDate(temp_password_expires_at.getDate() + 7);

            const userPayload = {
                institute_id,
                role: 'student',
                name: r.name.trim(),
                email: r.email,
                phone: r.phone?.trim() || null,
                password_hash: await bcrypt.hash(pw, 10),
                status: 'active',
                is_first_login: true,
                temp_password_expires_at,
                credentials_sent_at: r.email ? new Date() : null,
                initial_password: pw
            };
            userPayloads.push(userPayload);
            validRowsWithPw.push({ ...r, pw });
            
            if (r.email) {
              emailsToDispatch.push({
                to: r.email,
                studentName: r.name.trim(),
                instituteName,
                email: r.email,
                tempPassword: pw
              });
            }
        }

        // 1. Bulk Create Users
        const createdUsers = await User.bulkCreate(userPayloads, { transaction: t, returning: true });

        // 2. Prepare Student Payloads
        const studentPayloads = [];
        for (let i = 0; i < validRowsWithPw.length; i++) {
            const r = validRowsWithPw[i];
            const u = createdUsers[i];
            studentPayloads.push({
                institute_id,
                user_id: u.id,
                roll_number: r.roll_number.trim(),
                class_id: r.class_id,
                gender: r.gender?.toLowerCase(),
                date_of_birth: parseExcelDate(r.date_of_birth),
                admission_date: parseExcelDate(r.admission_date) || new Date(),
                address: r.address?.trim() || null,
                is_full_course: r.isFullCourse,
            });
        }

        // 3. Bulk Create Students
        const createdStudents = await Student.bulkCreate(studentPayloads, { transaction: t, returning: true });

        // 4. Prepare Links
        const studentClassPayloads = [];
        const studentSubjectPayloads = [];

        for (let i = 0; i < validRowsWithPw.length; i++) {
            const r = validRowsWithPw[i];
            const s = createdStudents[i];
            
            studentClassPayloads.push({
                student_id: s.id,
                class_id: r.class_id,
                institute_id: institute_id
            });

            if (r.isFullCourse) {
                const subjectsForClass = allSubjects.filter(sub => sub.class_id === r.class_id).map(sub => sub.id);
                for (const sub_id of subjectsForClass) {
                    studentSubjectPayloads.push({
                        student_id: s.id,
                        subject_id: sub_id,
                        institute_id: institute_id
                    });
                }
            } else if (r.subjectIdsToAssign && r.subjectIdsToAssign.length > 0) {
                for (const sub_id of r.subjectIdsToAssign) {
                    studentSubjectPayloads.push({
                        student_id: s.id,
                        subject_id: sub_id,
                        institute_id: institute_id
                    });
                }
            }
        }

        // 5. Bulk Create Links
        if (studentClassPayloads.length > 0) await StudentClass.bulkCreate(studentClassPayloads, { transaction: t });
        if (studentSubjectPayloads.length > 0) await StudentSubject.bulkCreate(studentSubjectPayloads, { transaction: t });

        await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    // Dispatch emails asynchronously in the background so we don't block the response
    if (emailsToDispatch.length > 0) {
      setTimeout(async () => {
        for (const emailData of emailsToDispatch) {
          try {
            await sendStudentWelcomeEmail(emailData);
          } catch(e) { console.error("Bulk Email Error:", e.message); }
        }
      }, 100);
    }

    // ── 8. Log the import ────────────────────────────────────────────────────
    await BulkImportLog.create({
      institute_id,
      import_type: 'students',
      imported_by: req.user.id,
      total_rows: rows.length,
      success_rows: validRows.length,
      failed_rows: errors.length,
      error_report: errors,
      status: errors.length === rows.length ? 'failed' : errors.length ? 'partial' : 'completed',
    });

    return res.json({
      success: true,
      inserted: validRows.length,
      failed: errors.length,
      errors,
    });

  } catch (err) {
    console.error('❌ Bulk student import error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error during bulk student import. Please try again.',
    });
  }
};
