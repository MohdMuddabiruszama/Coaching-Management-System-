/**
 * Reports Controller - Professional Implementation
 * Implements comprehensive reporting and analytics system
 */

const { Attendance, Student, Class, User, Faculty, Payment, Institute, Plan, Subscription } = require("../models");
const { Op } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Get Institute Dashboard Analytics
 * @route GET /api/reports/dashboard
 * @access Admin, Faculty
 */
exports.getDashboardAnalytics = async (req, res) => {
    try {
        const institute_id = req.user.institute_id;
        const today = new Date().toISOString().split('T')[0];
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

        // Total counts
        const totalStudents = await Student.count({ where: { institute_id } });
        const totalFaculty = await Faculty.count({ where: { institute_id } });
        const totalClasses = await Class.count({ where: { institute_id } });

        // Today's attendance
        const todayAttendance = await Attendance.findAll({
            where: { institute_id, date: today }
        });
        const todayPresent = todayAttendance.filter(r => r.status === 'present').length;
        const todayPercentage = todayAttendance.length > 0 ? ((todayPresent / todayAttendance.length) * 100).toFixed(2) : 0;

        // This month's fees collected
        const monthlyFees = await Payment.sum('amount_paid', {
            where: {
                institute_id,
                payment_date: { [Op.gte]: startOfMonth }
            }
        }) || 0;

        // New admissions this month
        const newAdmissions = await Student.count({
            where: {
                institute_id,
                createdAt: { [Op.gte]: startOfMonth }
            }
        });

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    total_students: totalStudents,
                    total_faculty: totalFaculty,
                    total_classes: totalClasses,
                    new_admissions_this_month: newAdmissions
                },
                today_attendance: {
                    total: todayAttendance.length,
                    present: todayPresent,
                    percentage: parseFloat(todayPercentage)
                },
                monthly_fees: {
                    collected: parseFloat(monthlyFees),
                    month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
                }
            }
        });
    } catch (error) {
        console.error("Error in getDashboardAnalytics:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get Attendance Report
 * @route GET /api/reports/attendance
 * @access Admin, Faculty
 */
exports.getAttendanceReport = async (req, res) => {
    try {
        const { start_date, end_date, class_id, student_id } = req.query;
        const institute_id = req.user.institute_id;

        // Validate date range and plan limits
        if (start_date && end_date) {
            const startDateObj = new Date(start_date);
            const endDateObj = new Date(end_date);
            if (startDateObj > endDateObj) {
                return res.status(400).json({
                    success: false,
                    message: "Start date must be before end date"
                });
            }

            // Verify plan limits
            const institute = await Institute.findByPk(institute_id, { include: [{ model: Plan }] });
            const reportsLevel = institute.current_feature_reports !== 'none' ? institute.current_feature_reports : (institute.Plan ? institute.Plan.feature_reports : 'none');

            if (reportsLevel !== 'advanced') {
                const diffDays = Math.ceil(Math.abs(endDateObj - startDateObj) / (1000 * 60 * 60 * 24));
                if (diffDays > 90) {
                    return res.status(403).json({
                        success: false,
                        message: "Your current plan limits report history to 90 days. Please upgrade to Pro for unlimited dates."
                    });
                }
            }
        }

        // Build where clause
        const whereClause = { institute_id };
        if (start_date && end_date) {
            whereClause.date = { [Op.between]: [start_date, end_date] };
        }
        if (class_id) whereClause.class_id = class_id;
        if (student_id) whereClause.student_id = student_id;

        // Fetch attendance records
        const records = await Attendance.findAll({
            where: whereClause,
            include: [
                {
                    model: Student,
                    attributes: ['id', 'roll_number'],
                    include: [{ model: User, attributes: ['name'] }]
                },
                {
                    model: Class,
                    attributes: ['id', 'name']
                }
            ],
            order: [['date', 'DESC']]
        });

        // Calculate summary
        const totalDays = records.length;
        const presentDays = records.filter(r => r.status === 'present').length;
        const absentDays = records.filter(r => r.status === 'absent').length;
        const lateDays = records.filter(r => r.status === 'late').length;
        const percentage = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(2) : 0;

        res.status(200).json({
            success: true,
            data: {
                records,
                summary: {
                    total_days: totalDays,
                    present_days: presentDays,
                    absent_days: absentDays,
                    late_days: lateDays,
                    percentage: parseFloat(percentage)
                },
                filters: { start_date, end_date, class_id, student_id }
            }
        });
    } catch (error) {
        console.error("Error in getAttendanceReport:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get Fees Collection Report
 * @route GET /api/reports/fees
 * @access Admin
 */
exports.getFeesReport = async (req, res) => {
    try {
        const { start_date, end_date, class_id, fee_type } = req.query;
        const institute_id = req.user.institute_id;

        // Validate date range and plan limits
        if (start_date && end_date) {
            const startDateObj = new Date(start_date);
            const endDateObj = new Date(end_date);
            if (startDateObj > endDateObj) {
                return res.status(400).json({
                    success: false,
                    message: "Start date must be before end date"
                });
            }

            // Verify plan limits
            const institute = await Institute.findByPk(institute_id, { include: [{ model: Plan }] });
            const reportsLevel = institute.current_feature_reports !== 'none' ? institute.current_feature_reports : (institute.Plan ? institute.Plan.feature_reports : 'none');

            if (reportsLevel !== 'advanced') {
                const diffDays = Math.ceil(Math.abs(endDateObj - startDateObj) / (1000 * 60 * 60 * 24));
                if (diffDays > 90) {
                    return res.status(403).json({
                        success: false,
                        message: "Your current plan limits report history to 90 days. Please upgrade to Pro for unlimited dates."
                    });
                }
            }
        }

        // Build where clause for payments
        const whereClause = { institute_id };
        if (start_date && end_date) {
            whereClause.payment_date = { [Op.between]: [start_date, end_date] };
        }

        // Fetch payments
        const studentInclude = [{ model: User, attributes: ['name'] }];
        if (class_id) {
            studentInclude.push({
                model: Class,
                attributes: [],
                where: { id: class_id }
            });
        }

        const { StudentFee, FeesStructure } = require('../models');

        const paymentIncludes = [
            {
                model: Student,
                attributes: ['id', 'roll_number'],
                include: studentInclude,
                required: class_id ? true : undefined
            }
        ];

        const feeStructureWhere = {};
        if (fee_type) {
            feeStructureWhere.fee_type = { [Op.like]: `%${fee_type}%` };
        }

        paymentIncludes.push({
            model: FeesStructure,
            attributes: ['fee_type'],
            where: Object.keys(feeStructureWhere).length > 0 ? feeStructureWhere : undefined,
            required: fee_type ? true : false
        });

        const payments = await Payment.findAll({
            where: whereClause,
            include: paymentIncludes,
            order: [['payment_date', 'DESC']]
        });

        // Calculate totals
        const totalCollected = payments.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0);
        const studentsWithPayments = payments.map(p => p.student_id);

        // Calculate totals
        
        const pendingWhere = { institute_id, status: { [Op.ne]: 'paid' }, due_amount: { [Op.gt]: 0 } };
        if (class_id) {
            pendingWhere.class_id = class_id;
        }

        const pendingFees = await StudentFee.findAll({
            where: pendingWhere,
            include: [
                {
                    model: Student,
                    attributes: ['id', 'roll_number'],
                    include: [{ model: User, attributes: ['name'] }],
                    required: true
                },
                {
                    model: FeesStructure,
                    attributes: ['fee_type', 'due_date'],
                    where: Object.keys(feeStructureWhere).length > 0 ? feeStructureWhere : undefined,
                    required: fee_type ? true : false
                }
            ],
            order: [[{ model: FeesStructure }, 'due_date', 'ASC']]
        });

        const uniquePendingStudentsCount = new Set(pendingFees.map(pf => pf.student_id)).size;

        // Generate Daily Trend Data
        let trendData = [];
        const endDateObj = end_date ? new Date(end_date) : new Date();
        const startDateObj = start_date ? new Date(start_date) : new Date(endDateObj.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const dateMap = {};
        for(let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
            const dStr = d.toISOString().split('T')[0];
            const shortName = d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
            dateMap[dStr] = { name: shortName, Collected: 0, Pending: 0 };
        }
        
        payments.forEach(p => {
            const dStr = p.payment_date;
            if(dateMap[dStr]) {
                dateMap[dStr].Collected += parseFloat(p.amount_paid);
            }
        });
        
        pendingFees.forEach(pf => {
            if(pf.FeesStructure && pf.FeesStructure.due_date) {
                const dStr = pf.FeesStructure.due_date;
                if(dateMap[dStr]) {
                    dateMap[dStr].Pending += parseFloat(pf.due_amount);
                }
            }
        });
        
        trendData = Object.values(dateMap);

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    total_collected: totalCollected.toFixed(2),
                    total_payments: payments.length,
                    students_paid: new Set(studentsWithPayments).size,
                    students_pending: uniquePendingStudentsCount
                },
                trend: trendData,
                payments,
                pending_students: pendingFees.map(pf => ({
                    student_id: pf.Student.id,
                    roll_number: pf.Student.roll_number,
                    name: pf.Student.User?.name,
                    pending_amount: pf.due_amount,
                    due_date: pf.FeesStructure?.due_date,
                    fee_type: pf.FeesStructure?.fee_type || 'General Fee',
                    reminder_date: pf.reminder_date
                })),
                filters: { start_date, end_date, class_id }
            }
        });
    } catch (error) {
        console.error("Error in getFeesReport:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get Student Performance Report
 * @route GET /api/reports/student-performance/:student_id
 * @access Admin, Faculty, Student (own)
 */
exports.getStudentPerformanceReport = async (req, res) => {
    try {
        const { student_id } = req.params;
        const institute_id = req.user.institute_id;

        // Verify student belongs to institute
        const student = await Student.findOne({
            where: { id: student_id, institute_id },
            include: [
                { model: User, attributes: ['name', 'email'] },
                { model: Class, attributes: ['name'] }
            ]
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        // Get attendance summary using distinct dates
        const attendanceRecords = await Attendance.findAll({
            where: { student_id, institute_id }
        });
        
        const uniqueDatesMap = {};
        attendanceRecords.forEach(r => {
            if (!uniqueDatesMap[r.date]) uniqueDatesMap[r.date] = [];
            uniqueDatesMap[r.date].push(r.status);
        });

        let totalDays = 0, presentDays = 0, absentDays = 0, lateDays = 0;
        Object.values(uniqueDatesMap).forEach(statuses => {
            if (!statuses.includes('holiday')) {
                totalDays++;
                if (statuses.includes('present') || statuses.includes('half_day')) {
                    presentDays++;
                } else if (statuses.includes('late')) {
                    lateDays++;
                } else if (statuses.includes('absent')) {
                    absentDays++;
                }
            }
        });

        const attendancePercentage = totalDays > 0 ? (((presentDays + lateDays) / totalDays) * 100).toFixed(2) : 0;

        // Get payment history
        const payments = await Payment.findAll({
            where: { student_id, institute_id },
            order: [['payment_date', 'DESC']],
            limit: 10
        });
        const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0);

        res.status(200).json({
            success: true,
            data: {
                student_info: {
                    id: student.id,
                    roll_number: student.roll_number,
                    name: student.User?.name,
                    email: student.User?.email,
                    class: student.Class?.name
                },
                attendance: {
                    total_days: totalDays,
                    present_days: presentDays,
                    absent_days: absentDays,
                    late_days: lateDays,
                    percentage: parseFloat(attendancePercentage)
                },
                fees: {
                    total_paid: totalPaid.toFixed(2),
                    payment_count: payments.length,
                    recent_payments: payments
                }
            }
        });
    } catch (error) {
        console.error("Error in getStudentPerformanceReport:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get Class Performance Summary
 * @route GET /api/reports/class-performance/:class_id
 * @access Admin, Faculty
 */
exports.getClassPerformanceReport = async (req, res) => {
    try {
        const { class_id } = req.params;
        const institute_id = req.user.institute_id;

        // Verify class belongs to institute
        const classInfo = await Class.findOne({
            where: { id: class_id, institute_id }
        });

        if (!classInfo) {
            return res.status(404).json({
                success: false,
                message: "Class not found"
            });
        }

        // Get all students in class
        const students = await Student.findAll({
            where: { class_id, institute_id },
            include: [{ model: User, attributes: ['name'] }]
        });

        // Calculate attendance for each student
        const studentPerformance = await Promise.all(students.map(async (student) => {
            const records = await Attendance.findAll({
                where: { student_id: student.id, class_id, institute_id }
            });
            
            const uniqueDatesMap = {};
            records.forEach(r => {
                if (!uniqueDatesMap[r.date]) uniqueDatesMap[r.date] = [];
                uniqueDatesMap[r.date].push(r.status);
            });

            let total = 0, present = 0, late = 0;
            Object.values(uniqueDatesMap).forEach(statuses => {
                if (!statuses.includes('holiday')) {
                    total++;
                    if (statuses.includes('present') || statuses.includes('half_day')) {
                        present++;
                    } else if (statuses.includes('late')) {
                        late++;
                    }
                }
            });

            const percentage = total > 0 ? (((present + late) / total) * 100).toFixed(2) : 0;

            return {
                student_id: student.id,
                roll_number: student.roll_number,
                name: student.User?.name,
                attendance_percentage: parseFloat(percentage),
                total_days: total,
                present_days: present
            };
        }));

        // Calculate class average
        const classAverage = studentPerformance.length > 0
            ? (studentPerformance.reduce((sum, s) => sum + s.attendance_percentage, 0) / studentPerformance.length).toFixed(2)
            : 0;

        res.status(200).json({
            success: true,
            data: {
                class_info: {
                    id: classInfo.id,
                    name: classInfo.name,
                    section: classInfo.section,
                    total_students: students.length
                },
                class_average_attendance: parseFloat(classAverage),
                student_performance: studentPerformance.sort((a, b) => b.attendance_percentage - a.attendance_percentage),
                at_risk_students: studentPerformance.filter(s => s.attendance_percentage < 75)
            }
        });
    } catch (error) {
        console.error("Error in getClassPerformanceReport:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get Monthly Trends (Attendance & Fees)
 * @route GET /api/reports/monthly-trends
 * @access Admin
 */
exports.getMonthlyTrends = async (req, res) => {
    try {
        const { months = 6 } = req.query;
        const institute_id = req.user.institute_id;

        const trends = [];
        const now = new Date();

        for (let i = parseInt(months) - 1; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString().split('T')[0];
            const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().split('T')[0];

            // Attendance for this month
            const attendanceRecords = await Attendance.findAll({
                where: {
                    institute_id,
                    date: { [Op.between]: [startOfMonth, endOfMonth] }
                }
            });
            const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
            const attendancePercentage = attendanceRecords.length > 0
                ? ((presentCount / attendanceRecords.length) * 100).toFixed(2)
                : 0;

            // Fees collected this month
            const feesCollected = await Payment.sum('amount_paid', {
                where: {
                    institute_id,
                    payment_date: { [Op.between]: [startOfMonth, endOfMonth] }
                }
            }) || 0;

            trends.push({
                month: monthDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
                attendance_percentage: parseFloat(attendancePercentage),
                fees_collected: parseFloat(feesCollected)
            });
        }

        res.status(200).json({
            success: true,
            data: trends
        });
    } catch (error) {
        console.error("Error in getMonthlyTrends:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get Super Admin Analytics
 * @route GET /api/reports/super-admin/analytics
 * @access Super Admin only
 */
exports.getSuperAdminAnalytics = async (req, res) => {
    try {
        // Total institutes
        const totalInstitutes = await Institute.count();
        const activeInstitutes = await Institute.count({ where: { status: 'active' } });

        // Total subscriptions
        const activeSubscriptions = await Subscription.count({
            where: {
                status: 'active',
                end_date: { [Op.gte]: new Date() }
            }
        });

        // Total revenue (all time)
        const totalRevenue = await Subscription.sum('amount') || 0;

        // Monthly Recurring Revenue (MRR)
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyRevenue = await Subscription.sum('amount', {
            where: {
                status: 'active',
                start_date: { [Op.lte]: now },
                end_date: { [Op.gte]: startOfMonth }
            }
        }) || 0;

        // Plan distribution
        const planDistribution = await Subscription.findAll({
            attributes: [
                'plan_id',
                [sequelize.fn('COUNT', sequelize.col('plan_id')), 'count']
            ],
            where: { status: 'active' },
            group: ['plan_id'],
            include: [{ model: Plan, attributes: ['name', 'price'] }]
        });

        // Expiring soon (next 30 days)
        const expiringSoon = await Subscription.count({
            where: {
                status: 'active',
                end_date: {
                    [Op.between]: [now, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)]
                }
            }
        });

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    total_institutes: totalInstitutes,
                    active_institutes: activeInstitutes,
                    active_subscriptions: activeSubscriptions,
                    total_revenue: parseFloat(totalRevenue),
                    monthly_recurring_revenue: parseFloat(monthlyRevenue)
                },
                plan_distribution: planDistribution,
                alerts: {
                    expiring_soon: expiringSoon
                }
            }
        });
    } catch (error) {
        console.error("Error in getSuperAdminAnalytics:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = exports;
