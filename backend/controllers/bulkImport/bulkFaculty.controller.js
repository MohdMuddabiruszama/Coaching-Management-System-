// backend/controllers/bulkImport/bulkFaculty.controller.js
// Handles POST /api/faculty/bulk-import
// Flow: plan limit check → batch email uniqueness check
//       → row-by-row validation → DB transaction insert → log → respond

const bcrypt = require('bcrypt');
const { User, Faculty, Institute, BulkImportLog, sequelize } = require('../../models');
const { validateFacultyRow, parseExcelDate } = require('../../utils/bulkValidation');

exports.bulkImportFaculty = async (req, res) => {
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

    // ── 1. Plan limit check ──────────────────────────────────────────────────
    const inst = await Institute.findByPk(institute_id, {
      attributes: ['current_limit_faculty'],
    });
    if (inst && inst.current_limit_faculty != null) {
      const existingCount = await Faculty.count({ where: { institute_id } });
      const slotsLeft = inst.current_limit_faculty - existingCount;
      if (rows.length > slotsLeft) {
        return res.status(400).json({
          success: false,
          message: `Plan limit: only ${slotsLeft} faculty slot(s) remaining. Your file has ${rows.length} rows.`,
        });
      }
    }

    // ── 2. Batch email existence check ───────────────────────────────────────
    const incomingEmails = rows
      .map(r => r.email?.toLowerCase().trim())
      .filter(Boolean);
    const existingUsers = await User.findAll({
      where: { email: incomingEmails },
      attributes: ['email'],
    });
    const takenEmails = new Set(existingUsers.map(u => u.email));
    const seenInBatch = new Set();

    // ── 3. Validate each row ─────────────────────────────────────────────────
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const rowErrors = validateFacultyRow(row);

      const email = row.email?.toLowerCase().trim();
      if (email) {
        if (takenEmails.has(email))   rowErrors.push('email already exists in system');
        if (seenInBatch.has(email))   rowErrors.push('duplicate email within file');
        else                          seenInBatch.add(email);
      }

      if (rowErrors.length) {
        errors.push({ row: rowNum, name: row.name || '', errors: rowErrors });
      } else {
        validRows.push({ ...row, email });
      }
    }

    // ── 4. Insert in a single DB transaction ─────────────────────────────────
    const t = await sequelize.transaction();
    try {
      for (const r of validRows) {
        const pw = r.password?.trim() || `faculty@${r.phone}`;
        const user = await User.create({
          institute_id,
          role: 'faculty',
          name: r.name.trim(),
          email: r.email,
          phone: r.phone?.trim(),
          password_hash: await bcrypt.hash(pw, 10),
          status: 'active',
        }, { transaction: t });

        await Faculty.create({
          institute_id,
          user_id: user.id,
          designation: r.designation?.trim() || null,
          address: r.address?.trim() || null,
          join_date: parseExcelDate(r.join_date) || new Date(),
        }, { transaction: t });
      }
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    // ── 5. Log the import ────────────────────────────────────────────────────
    await BulkImportLog.create({
      institute_id,
      import_type: 'faculty',
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
    console.error('❌ Bulk faculty import error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error during bulk faculty import. Please try again.',
    });
  }
};
