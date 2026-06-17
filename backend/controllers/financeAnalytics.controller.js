/**
 * Finance Analytics Controller
 * Revenue summary, P&L, monthly trends — Admin only
 */

const { StudentFee, Expense, FacultySalary, Payment, Faculty, User, sequelize } = require("../models");
const { Op, fn, col, literal } = require("sequelize");

// ── Revenue Summary (KPI cards) — Admin only ─────────────────────────────────
exports.getRevenueSummary = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Access denied: Admin only" });
        }

        const institute_id = req.user.institute_id;
        const { month_year } = req.query;

        // Total Revenue — from Payment (cash collected)
        const payWhere = { institute_id, status: "success" };
        if (month_year) {
            const [y, m] = month_year.split("-");
            payWhere.payment_date = {
                [Op.between]: [
                    new Date(y, m - 1, 1),
                    new Date(y, m, 0, 23, 59, 59)
                ]
            };
        }
        const totalRevenue = await Payment.sum("amount_paid", { where: payWhere }) || 0;

        // Total Expenses
        const expWhere = { institute_id };
        if (month_year) {
            const [y, m] = month_year.split("-");
            expWhere.date = {
                [Op.between]: [
                    new Date(y, m - 1, 1),
                    new Date(y, m, 0, 23, 59, 59)
                ]
            };
        }
        const totalExpenses = await Expense.sum("amount", { where: expWhere }) || 0;

        // Total Salaries Paid
        const salWhere = { institute_id, status: "paid" };
        if (month_year) salWhere.month_year = month_year;
        const totalSalaries = await FacultySalary.sum("net_salary", { where: salWhere }) || 0;

        // Pending Salaries
        const salPendingWhere = { institute_id, status: { [Op.ne]: "paid" } };
        if (month_year) salPendingWhere.month_year = month_year;
        const pendingSalaries = await FacultySalary.sum("net_salary", { where: salPendingWhere }) || 0;
        
        const totalPayroll = parseFloat(totalSalaries) + parseFloat(pendingSalaries);

        // Pending Fees — from StudentFee
        const sfPendingWhere = { institute_id, status: ["pending", "partial"] };
        const totalPendingDue = await StudentFee.sum("due_amount", { where: sfPendingWhere }) || 0;

        // Total collected (from StudentFee paid_amount across all)
        const totalCollected = await StudentFee.sum("paid_amount", { where: { institute_id } }) || 0;

        // P&L Calculation
        const totalCosts = parseFloat(totalExpenses) + parseFloat(totalSalaries);
        const netProfitLoss = parseFloat(totalRevenue) - totalCosts;

        res.json({
            success: true,
            data: {
                revenue: { total: parseFloat(totalRevenue), label: "Total Fees Collected" },
                expenses: { total: parseFloat(totalExpenses), label: "Operational Expenses" },
                salaries: { 
                    total: parseFloat(totalSalaries), 
                    pending: parseFloat(pendingSalaries),
                    payroll: totalPayroll,
                    label: "Faculty Salaries Paid" 
                },
                total_costs: { total: totalCosts, label: "Total Costs" },
                profit_loss: { amount: netProfitLoss, is_profit: netProfitLoss >= 0 },
                pending: { total: parseFloat(totalPendingDue), label: "Pending Fee Collections" },
                total_collected: parseFloat(totalCollected)
            }
        });
    } catch (err) {
        console.error("getRevenueSummary error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Monthly Trend — last 12 months — Admin only ──────────────────────────────
exports.getMonthlyTrend = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Access denied: Admin only" });
        }

        const institute_id = req.user.institute_id;

        // Build last 12 months list
        const months = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() - i);
            months.push(d.toISOString().slice(0, 7));
        }

        // Revenue per month (from Payments)
        const revenueRows = await Payment.findAll({
            attributes: [
                [literal("TO_CHAR(payment_date, 'YYYY-MM')"), "month_year"],
                [fn("SUM", col("amount_paid")), "total"]
            ],
            where: {
                institute_id,
                status: "success",
                payment_date: {
                    [Op.gte]: new Date(months[0] + "-01")
                }
            },
            group: [literal("TO_CHAR(payment_date, 'YYYY-MM')")],
            order: [[literal("TO_CHAR(payment_date, 'YYYY-MM')"), "ASC"]],
            raw: true
        });

        // Expenses per month
        const expenseRows = await Expense.findAll({
            attributes: [
                [literal("TO_CHAR(date, 'YYYY-MM')"), "month_year"],
                [fn("SUM", col("amount")), "total"]
            ],
            where: {
                institute_id,
                date: { [Op.gte]: new Date(months[0] + "-01") }
            },
            group: [literal("TO_CHAR(date, 'YYYY-MM')")],
            order: [[literal("TO_CHAR(date, 'YYYY-MM')"), "ASC"]],
            raw: true
        });

        // Salaries per month
        const salaryRows = await FacultySalary.findAll({
            attributes: [
                "month_year",
                [fn("SUM", col("net_salary")), "total"]
            ],
            where: {
                institute_id,
                status: "paid",
                month_year: { [Op.in]: months }
            },
            group: ["month_year"],
            order: [["month_year", "ASC"]],
            raw: true
        });

        // Build indexed maps
        const revenueMap = {};
        revenueRows.forEach(r => { revenueMap[r.month_year] = parseFloat(r.total) || 0; });

        const expenseMap = {};
        expenseRows.forEach(r => { expenseMap[r.month_year] = parseFloat(r.total) || 0; });

        const salaryMap = {};
        salaryRows.forEach(r => { salaryMap[r.month_year] = parseFloat(r.total) || 0; });

        // Combine into chart-ready array
        const chartData = months.map(m => {
            const revenue = revenueMap[m] || 0;
            const expenses = expenseMap[m] || 0;
            const salaries = salaryMap[m] || 0;
            const totalCosts = expenses + salaries;
            const [year, monthNum] = m.split("-");
            const label = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
                .toLocaleString("default", { month: "short", year: "2-digit" });

            return {
                month: label,
                month_year: m,
                revenue,
                expenses,
                salaries,
                total_costs: totalCosts,
                profit: revenue - totalCosts
            };
        });

        res.json({
            success: true,
            data: { months, chartData }
        });
    } catch (err) {
        console.error("getMonthlyTrend error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Expense Breakdown by Category — Admin only ───────────────────────────────
exports.getExpenseByCategory = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Access denied: Admin only" });
        }

        const institute_id = req.user.institute_id;
        const { month_year } = req.query;

        const where = { institute_id };
        if (month_year) {
            const [y, m] = month_year.split("-");
            where.date = {
                [Op.between]: [
                    new Date(y, m - 1, 1),
                    new Date(y, m, 0, 23, 59, 59)
                ]
            };
        }

        const rows = await Expense.findAll({
            attributes: [
                "category",
                [fn("SUM", col("amount")), "amount"]
            ],
            where,
            group: ["category"],
            order: [[fn("SUM", col("amount")), "DESC"]],
            raw: true
        });

        res.json({ success: true, data: rows });
    } catch (err) {
        console.error("getExpenseByCategory error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Defaulter List — Admin only ──────────────────────────────────────────────
exports.getDefaulterList = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Access denied: Admin only" });
        }

        const institute_id = req.user.institute_id;
        const { StudentFee: SF, Student, User: U, Class, FeesStructure } = require("../models");

        const today = new Date().toISOString().split("T")[0];

        const overdueFees = await SF.findAll({
            where: {
                institute_id,
                status: ["pending", "partial"]
            },
            include: [
                { model: Student, include: [{ model: U, attributes: ["name", "email"] }] },
                { model: Class, attributes: ["name", "section"] },
                { model: FeesStructure, attributes: ["fee_type", "due_date", "amount"] }
            ],
            order: [["due_amount", "DESC"]]
        });

        // Filter to overdue ones (due date past)
        const defaulters = overdueFees.filter(sf => {
            const dueDate = sf.FeesStructure?.due_date;
            return dueDate && dueDate < today;
        });

        res.json({ success: true, data: defaulters });
    } catch (err) {
        console.error("getDefaulterList error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Salary Report (for current month, admin only) ────────────────────────────
exports.getSalaryReport = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Access denied: Admin only" });
        }

        const institute_id = req.user.institute_id;
        const { month_year } = req.query;
        const targetMonth = month_year || new Date().toISOString().slice(0, 7);

        const salaries = await FacultySalary.findAll({
            where: { institute_id },
            include: [
                {
                    model: Faculty,
                    include: [{ model: User, attributes: ["name", "email"] }]
                }
            ],
            order: [["net_salary", "DESC"]],
            raw: false
        });

        // Aggregate by faculty (last month salary as base)
        const facultyMap = {};
        salaries.forEach(s => {
            const fid = s.faculty_id;
            if (!facultyMap[fid]) {
                facultyMap[fid] = {
                    faculty: s.Faculty,
                    totalPaid: 0,
                    lastMonthSalary: 0,
                    salaries: []
                };
            }
            if (s.status === "paid") {
                facultyMap[fid].totalPaid += parseFloat(s.net_salary || 0);
            }
            if (s.month_year === targetMonth) {
                facultyMap[fid].lastMonthSalary = parseFloat(s.net_salary || 0);
                facultyMap[fid].currentRecord = s;
            }
            facultyMap[fid].salaries.push(s);
        });

        const data = Object.values(facultyMap).map(f => ({
            faculty_id: f.faculty?.id,
            faculty_name: f.faculty?.User?.name || "Unknown",
            faculty_email: f.faculty?.User?.email || "",
            total_paid_all_time: f.totalPaid,
            current_month_salary: f.lastMonthSalary,
            current_status: f.currentRecord?.status || "not_created",
            currentRecord: f.currentRecord || null,
            salary_history: f.salaries
        }));

        res.json({ success: true, data, month_year: targetMonth });
    } catch (err) {
        console.error("getSalaryReport error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};
