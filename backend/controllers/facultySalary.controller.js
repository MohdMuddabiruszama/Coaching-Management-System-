/**
 * Faculty Salary Controller — Performance Optimized
 * Phase 3 — Faculty Salary.md
 *
 * Performance principles applied:
 *   createSalary:   Promise.all() → 2 parallel queries + 1 INSERT (was sequential)
 *   getAllSalaries:  1 query with JOIN + pagination
 *   getSalaryReport: 1 aggregated SQL query (was 3 separate COUNT/SUM queries)
 *   paySalary:      1 lookup + 1 UPDATE (accepts specific payment_date)
 *   updateSalary:   guard paid records + auto-recalculate via salaryCalc
 *   deleteSalary:   unchanged
 */

const { FacultySalary, FacultySalarySettings, Faculty, User, Institute } = require("../models");
const { Op, fn, col, literal } = require("sequelize");
const { computeNetSalary, buildDueDate } = require("../utils/salaryCalc");

// ─────────────────────────────────────────────────────────────────────────────
// CREATE SALARY — 2 parallel queries → 1 INSERT
// ─────────────────────────────────────────────────────────────────────────────
exports.createSalary = async (req, res) => {
    try {
        const iid = req.user.institute_id;
        const {
            faculty_id, month_year, basic_salary, allowances = 0,
            deductions = 0, advance_paid = 0, present_days,
            working_days = 26, payment_due_date, remarks,
        } = req.body;

        // Validate month_year format
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month_year)) {
            return res.status(400).json({ success: false, message: "month_year must be YYYY-MM format" });
        }

        // PARALLEL: check duplicate + verify faculty exist simultaneously — O(1) per query
        const [existing, faculty] = await Promise.all([
            FacultySalary.findOne({
                where: { institute_id: iid, faculty_id, month_year },
                attributes: ['id'],   // minimum data — only need id
            }),
            Faculty.findOne({
                where: { id: faculty_id, institute_id: iid },
                include: [{ model: User, attributes: ['id', 'name', 'email'] }],
                attributes: ['id', 'user_id'],
            }),
        ]);

        if (existing) {
            return res.status(409).json({ success: false, message: `Salary for ${month_year} already exists for this faculty` });
        }
        if (!faculty) {
            return res.status(404).json({ success: false, message: "Faculty not found in this institute" });
        }

        // Compute all financial values — O(1)
        const { earned_salary, net_salary } = computeNetSalary({
            basic_salary, allowances, deductions, advance_paid, present_days, working_days,
        });

        if (net_salary < 0) {
            return res.status(422).json({ success: false, message: "Deductions exceed earned salary. Please review values." });
        }

        // Determine payment_due_date — use provided or auto-compute from settings
        let dueDate = payment_due_date || null;
        if (!dueDate) {
            const settings = await FacultySalarySettings.findOne({
                where: { faculty_id: faculty.user_id, institute_id: iid },
                attributes: ['salary_due_day'],
            });
            if (settings) dueDate = buildDueDate(month_year, settings.salary_due_day);
        }

        const salary = await FacultySalary.create({
            institute_id:    iid,
            faculty_id,
            month_year,
            basic_salary:    parseFloat(basic_salary),
            allowances:      parseFloat(allowances)   || 0,
            deductions:      parseFloat(deductions)   || 0,
            advance_paid:    parseFloat(advance_paid) || 0,
            net_salary,
            working_days:    parseInt(working_days)   || 26,
            present_days:    parseInt(present_days)   || 0,
            payment_due_date: dueDate,
            status:          'pending',
            auto_generated:  false,
            remarks:         remarks || null,
        });

        return res.status(201).json({
            success: true,
            message: "Salary record created",
            data: { salary, faculty_name: faculty.User?.name },
        });
    } catch (err) {
        console.error("createSalary error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL SALARIES — 1 query with JOIN + pagination
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllSalaries = async (req, res) => {
    try {
        const iid = req.user.institute_id;
        const { month_year, faculty_id, status, page = 1, limit = 50 } = req.query;

        const where = { institute_id: iid };
        if (month_year) where.month_year = month_year;
        if (faculty_id) where.faculty_id = faculty_id;
        if (status)     where.status     = status;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Single query — JOIN Faculty→User to get faculty name + paidBy user
        const { count, rows } = await FacultySalary.findAndCountAll({
            where,
            include: [
                {
                    model: Faculty,
                    include: [{ model: User, attributes: ['id', 'name', 'email'] }],
                    attributes: ['id'],
                },
                {
                    model: User,
                    as: 'paidBy',
                    attributes: ['id', 'name'],
                    required: false,
                },
            ],
            order: [['month_year', 'DESC'], ['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset,
        });

        res.json({
            success: true,
            data: rows,
            pagination: {
                total:  count,
                page:   parseInt(page),
                limit:  parseInt(limit),
                pages:  Math.ceil(count / parseInt(limit)),
            },
        });
    } catch (err) {
        console.error("getAllSalaries error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// SALARY REPORT — 1 aggregated query (replaces 3 separate COUNT/SUM queries)
// ─────────────────────────────────────────────────────────────────────────────
exports.getSalaryReport = async (req, res) => {
    try {
        const iid = req.user.institute_id;
        const { month_year } = req.query;

        const where = { institute_id: iid };
        if (month_year) where.month_year = month_year;

        // ONE aggregated query — all stats computed in DB, not JS
        const stats = await FacultySalary.findAll({
            where,
            attributes: [
                [fn('COUNT', col('id')),                                                     'total_records'],
                [fn('COALESCE', fn('SUM', col('net_salary')), literal('0')),                 'total_payroll'],
                [fn('COALESCE', fn('SUM', literal(`CASE WHEN status='paid'    THEN net_salary ELSE 0 END`)), literal('0')), 'total_paid'],
                [fn('COALESCE', fn('SUM', literal(`CASE WHEN status='pending' THEN net_salary ELSE 0 END`)), literal('0')), 'total_pending'],
                [fn('COUNT', literal(`CASE WHEN status='paid'    THEN 1 END`)),              'paid_count'],
                [fn('COUNT', literal(`CASE WHEN status='pending' THEN 1 END`)),              'pending_count'],
                [fn('COUNT', literal(`CASE WHEN status='on_hold' THEN 1 END`)),              'on_hold_count'],
                [fn('COUNT', literal(`CASE WHEN payment_due_date < CURRENT_DATE AND status='pending' THEN 1 END`)), 'overdue_count'],
                [fn('COUNT', literal(`CASE WHEN auto_generated = TRUE THEN 1 END`)),         'auto_generated_count'],
            ],
            raw: true,
        });

        res.json({ success: true, data: stats[0] });
    } catch (err) {
        console.error("getSalaryReport error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// Keep backward-compat alias (used by older routes)
exports.getSalaryMonthReport = exports.getSalaryReport;

// ─────────────────────────────────────────────────────────────────────────────
// PAY SALARY — accepts specific payment_date
// ─────────────────────────────────────────────────────────────────────────────
exports.paySalary = async (req, res) => {
    try {
        const iid = req.user.institute_id;
        const { id } = req.params;
        const { payment_method, transaction_ref, payment_date, remarks } = req.body;

        // Minimal lookup — attributes list reduces data transfer
        const salary = await FacultySalary.findOne({
            where: { id, institute_id: iid },
            attributes: ['id', 'status', 'faculty_id', 'month_year', 'net_salary'],
        });

        if (!salary) {
            return res.status(404).json({ success: false, message: "Salary record not found" });
        }
        if (salary.status === 'paid') {
            return res.status(409).json({ success: false, message: "Salary already paid — cannot pay twice" });
        }

        await salary.update({
            status:          'paid',
            payment_method:  payment_method || 'bank_transfer',
            transaction_ref: transaction_ref || null,
            payment_date:    payment_date   || new Date(), // specific date or today
            paid_by:         req.user.id,
            remarks:         remarks || salary.remarks || null,
        });

        // Reload to get full record
        await salary.reload();
        res.json({ success: true, message: "Salary marked as paid", data: salary });
    } catch (err) {
        console.error("paySalary error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE SALARY — guard paid records + auto-recalculate net salary
// ─────────────────────────────────────────────────────────────────────────────
exports.updateSalary = async (req, res) => {
    try {
        const iid = req.user.institute_id;
        const { id } = req.params;

        const salary = await FacultySalary.findOne({ where: { id, institute_id: iid } });
        if (!salary) {
            return res.status(404).json({ success: false, message: "Salary record not found" });
        }
        if (salary.status === 'paid') {
            return res.status(403).json({ success: false, message: "Cannot edit a paid salary record" });
        }

        // Merge existing values with incoming updates
        const merged = {
            basic_salary:  req.body.basic_salary  !== undefined ? req.body.basic_salary  : salary.basic_salary,
            allowances:    req.body.allowances    !== undefined ? req.body.allowances    : salary.allowances,
            deductions:    req.body.deductions    !== undefined ? req.body.deductions    : salary.deductions,
            advance_paid:  req.body.advance_paid  !== undefined ? req.body.advance_paid  : salary.advance_paid,
            present_days:  req.body.present_days  !== undefined ? req.body.present_days  : salary.present_days,
            working_days:  req.body.working_days  !== undefined ? req.body.working_days  : salary.working_days,
        };

        const { net_salary } = computeNetSalary(merged);
        if (net_salary < 0) {
            return res.status(422).json({ success: false, message: "Deductions exceed earned salary" });
        }

        const updatePayload = {
            ...merged,
            net_salary,
        };
        if (req.body.payment_due_date !== undefined) updatePayload.payment_due_date = req.body.payment_due_date;
        if (req.body.remarks          !== undefined) updatePayload.remarks          = req.body.remarks;
        if (req.body.status           !== undefined && salary.status !== 'paid') updatePayload.status = req.body.status;

        await salary.update(updatePayload);
        res.json({ success: true, message: "Salary record updated", data: salary });
    } catch (err) {
        console.error("updateSalary error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE SALARY
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteSalary = async (req, res) => {
    try {
        const { id } = req.params;
        const iid = req.user.institute_id;

        const salary = await FacultySalary.findOne({ where: { id, institute_id: iid } });
        if (!salary) {
            return res.status(404).json({ success: false, message: "Salary record not found" });
        }

        await salary.destroy();
        res.json({ success: true, message: "Salary record deleted" });
    } catch (err) {
        console.error("deleteSalary error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};
