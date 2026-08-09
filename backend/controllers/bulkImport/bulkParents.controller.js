// backend/controllers/bulkImport/bulkParents.controller.js
// Handles POST /api/parents/bulk-import
// Extra step vs students: after creating parent user, resolves student_roll_number
// to a student_id and creates the student_parents junction row.

const bcrypt = require('bcrypt');
const { User, Student, BulkImportLog, sequelize } = require('../../models');
const { validateParentRow } = require('../../utils/bulkValidation');

exports.bulkImportParents = async (req, res) => {
  try {
    const { rows } = req.body;
    const institute_id = req.user.institute_id;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.json({ success: true, inserted: 0, failed: 0, errors: [] });
    }

    if (rows.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 500 rows per import. Please split your file.',
      });
    }

    const errors = [];
    const validRows = [];

    // ── 1. Load all students in institute for roll_number → student_id lookup ─
    const students = await Student.findAll({
      where: { institute_id },
      attributes: ['id', 'roll_number'],
    });
    const rollToStudentId = {};
    students.forEach(s => {
      rollToStudentId[s.roll_number.trim()] = s.id;
    });

    // ── 2. Batch email existence check ───────────────────────────────────────
    const incomingEmails = rows
      .map(r => String(r.email || '').toLowerCase().trim())
      .filter(Boolean);
    const existingUsers = await User.findAll({
      where: { email: incomingEmails },
      attributes: ['email'],
      paranoid: false,
    });
    const takenEmails = new Set(existingUsers.map(u => u.email));
    const seenInBatch = new Set();

    // ── 3. Validate each row ─────────────────────────────────────────────────
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const rowErrors = validateParentRow(row);

      const email = String(row.email || '').toLowerCase().trim();
      if (email) {
        if (takenEmails.has(email))   rowErrors.push('email already exists in system');
        if (seenInBatch.has(email))   rowErrors.push('duplicate email within file');
        else                          seenInBatch.add(email);
      }

      const studentId = rollToStudentId[String(row.student_roll_number || '').trim()];
      if (!studentId) {
        rowErrors.push(`no student found with roll number '${row.student_roll_number}'`);
      }

      if (rowErrors.length) {
        errors.push({ row: rowNum, name: row.name || '', errors: rowErrors });
      } else {
        validRows.push({ ...row, email, student_id: studentId });
      }
    }

    // ── 4. Insert in a single DB transaction ─────────────────────────────────
    // Pre-hash passwords in parallel to avoid Vercel 10s timeout
    const hashes = await Promise.all(
      validRows.map(r => {
        const pw = String(r.password || '').trim() || `parent@${r.phone}`;
        return bcrypt.hash(pw, 10);
      })
    );

    const t = await sequelize.transaction();
    try {
      for (let i = 0; i < validRows.length; i++) {
        const r = validRows[i];
        const user = await User.create({
          institute_id,
          role: 'parent',
          name: String(r.name || '').trim(),
          email: r.email || null,
          phone: String(r.phone || '').trim(),
          password_hash: hashes[i],
          status: 'active',
        }, { transaction: t });

        // Link parent to student via student_parents junction table
        await sequelize.query(
          `INSERT INTO student_parents (student_id, parent_id, relationship, created_at, updated_at)
           VALUES (:sid, :pid, :rel, NOW(), NOW())`,
          {
            replacements: {
              sid: r.student_id,
              pid: user.id,
              rel: String(r.relationship || '').toLowerCase(),
            },
            transaction: t,
          }
        );
      }
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    // ── 5. Log the import ────────────────────────────────────────────────────
    await BulkImportLog.create({
      institute_id,
      import_type: 'parents',
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
    console.error('❌ Bulk parent import error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error during bulk parent import. Please try again.',
    });
  }
};
