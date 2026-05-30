/**
 * Manager Dashboard Controller
 * Returns operational stats for manager, scoped by their permissions.
 * Does NOT expose revenue/profit/salary totals — admin-only data is never returned.
 */
const {
    Payment, Expense, Student, StudentFee, User,
    Attendance, Class, Faculty, Subject, Note, Exam, Assignment,
    FeeDiscountLog
} = require("../models");
const { Op } = require("sequelize");

exports.getManagerDashboardStats = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];

        // Helper: check if manager has a permission (key or key.*)
        const hasPerm = (...keys) => keys.some(k =>
            perms.includes(k) || perms.some(p => p.startsWith(k + '.'))
        );

        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

        const result = {};

        // ── PHASE 1: FEES ──────────────────────────────────────────────
        if (hasPerm('fees', 'collect_fees')) {
            result.todayCollection = await Payment.sum("amount_paid", {
                where: {
                    institute_id,
                    payment_date: { [Op.between]: [todayStart, todayEnd] },
                    status: "success"
                }
            }) || 0;

            result.totalDiscount = await FeeDiscountLog.sum("discount_amount", {
                where: { institute_id }
            }) || 0;

            // Recent 5 payments
            result.recentPayments = await Payment.findAll({
                where: { institute_id, status: "success" },
                order: [["payment_date", "DESC"]],
                limit: 5,
                include: [{ model: Student, include: [{ model: User, attributes: ["name"] }] }]
            });
        }

        // ── EXPENSES ───────────────────────────────────────────────────
        if (hasPerm('expenses')) {
            result.totalExpenses = await Expense.sum("amount", {
                where: {
                    institute_id,
                    date: { [Op.between]: [monthStart, monthEnd] }
                }
            }) || 0;
        }

        // ── PHASE 2: DATA / RECORDS ────────────────────────────────────
        if (hasPerm('students')) {
            result.totalStudents = await Student.count({ where: { institute_id } });
            // Active/blocked status is on the User table, not Student table
            result.activeStudents = await Student.count({
                where: { institute_id },
                include: [{ model: User, where: { status: 'active' }, attributes: [] }]
            });
            result.blockedStudents = await Student.count({
                where: { institute_id },
                include: [{ model: User, where: { status: 'blocked' }, attributes: [] }]
            });
        }

        if (hasPerm('faculty')) {
            result.totalFaculty = await Faculty.count({ where: { institute_id } });
        }

        if (hasPerm('classes')) {
            result.totalClasses = await Class.count({ where: { institute_id } });
        }

        if (hasPerm('subjects')) {
            result.totalSubjects = await Subject.count({ where: { institute_id } });
        }

        if (hasPerm('parents')) {
            // Parents are Users with role 'parent' in this institute
            result.totalParents = await User.count({
                where: { institute_id, role: 'parent' }
            });
        }

        // ── PHASE 3: ACADEMIC ──────────────────────────────────────────
        if (hasPerm('notes')) {
            result.totalNotes = await Note.count({ where: { institute_id } });
        }

        if (hasPerm('exams')) {
            result.totalExams = await Exam.count({ where: { institute_id } });
        }

        if (hasPerm('assignments')) {
            result.totalAssignments = await Assignment.count({ where: { institute_id } });
        }

        if (hasPerm('attendance')) {
            result.attendanceToday = await Attendance.count({
                where: { institute_id, date: { [Op.between]: [todayStart, todayEnd] } }
            });
            result.presentToday = await Attendance.count({
                where: {
                    institute_id,
                    date: { [Op.between]: [todayStart, todayEnd] },
                    status: "present"
                }
            });
            result.attendanceRate = result.attendanceToday > 0
                ? Math.round((result.presentToday / result.attendanceToday) * 100)
                : 0;
        }

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error("Manager dashboard stats error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Manager Finance Dashboard — LIMITED data only
 * Only accessible by managers who have 'finance' permission.
 */
exports.getManagerFinanceDashboard = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const manager_type = req.user.manager_type || 'custom';

        const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
        const hasFinanceAccess = perms.includes('finance');

        if (!hasFinanceAccess) {
            return res.status(403).json({ success: false, message: 'Finance Dashboard access not granted.' });
        }

        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        const todayCollections = await Payment.sum('amount_paid', {
            where: {
                institute_id,
                payment_date: { [Op.between]: [todayStart, todayEnd] },
                status: 'success'
            }
        }) || 0;

        const pendingList = await StudentFee.findAll({
            where: { institute_id, status: { [Op.in]: ['pending', 'partial'] } },
            include: [
                { model: Student, include: [{ model: User, attributes: ['name', 'email'] }] },
            ],
            order: [['due_amount', 'DESC']],
            limit: 15
        });

        const recentReceipts = await Payment.findAll({
            where: { institute_id, status: 'success' },
            include: [{ model: Student, include: [{ model: User, attributes: ['name'] }] }],
            order: [['payment_date', 'DESC']],
            limit: 10
        });

        const totalPendingAmount = await StudentFee.sum('due_amount', {
            where: { institute_id, status: { [Op.in]: ['pending', 'partial'] } }
        }) || 0;

        return res.json({
            success: true,
            manager_type,
            data: {
                today_collections: parseFloat(todayCollections),
                total_pending_amount: parseFloat(totalPendingAmount),
                pending_list: pendingList,
                recent_receipts: recentReceipts,
            }
        });
    } catch (err) {
        console.error('getManagerFinanceDashboard error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
