const { Expense, Subscription, Payment, sequelize } = require("../models");
const { Op } = require("sequelize");

exports.getExpenses = async (req, res) => {
    try {
        const { role, institute_id } = req.user;
        const { period, dateValue } = req.query;

        const whereClause = role === "super_admin" ? { institute_id: null } : { institute_id };

        if (period === 'month' && dateValue) {
            const [year, month] = dateValue.split('-');
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            whereClause.date = { [Op.between]: [startDate, endDate] };
        } else if (period === 'year' && dateValue) {
            const startDate = new Date(dateValue, 0, 1);
            const endDate = new Date(dateValue, 11, 31, 23, 59, 59);
            whereClause.date = { [Op.between]: [startDate, endDate] };
        } else if (period === 'current_month') {
            const currentDate = new Date();
            const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
            whereClause.date = { [Op.between]: [startDate, endDate] };
        } // 'all' requires no date filter

        const expenses = await Expense.findAll({
            where: whereClause,
            order: [["date", "DESC"]],
        });

        res.status(200).json({ success: true, expenses });
    } catch (error) {
        console.error("Error fetching expenses:", error);
        res.status(500).json({ success: false, message: "Failed to fetch expenses" });
    }
};

exports.addExpense = async (req, res) => {
    try {
        const { title, amount, category, date, description } = req.body;
        const { role, institute_id } = req.user;

        if (!title || !amount || !category) {
            return res.status(400).json({ success: false, message: "Title, amount, and category are required" });
        }

        const expense = await Expense.create({
            institute_id: role === "super_admin" ? null : institute_id,
            title,
            amount,
            category,
            date: date || new Date(),
            description,
            created_by: req.user.id || null,
        });

        res.status(201).json({ success: true, expense, message: "Expense added successfully" });
    } catch (error) {
        console.error("Error adding expense:", error);
        res.status(500).json({ success: false, message: "Failed to add expense" });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const { role, institute_id } = req.user;

        const whereClause = { id };
        if (role !== "super_admin") {
            whereClause.institute_id = institute_id;
        } else {
            whereClause.institute_id = null;
        }

        const deletedCount = await Expense.destroy({ where: whereClause });

        if (deletedCount === 0) {
            return res.status(404).json({ success: false, message: "Expense not found" });
        }

        res.status(200).json({ success: true, message: "Expense deleted successfully" });
    } catch (error) {
        console.error("Error deleting expense:", error);
        res.status(500).json({ success: false, message: "Failed to delete expense" });
    }
};

exports.getExpenseStats = async (req, res) => {
    try {
        const { role, institute_id } = req.user;
        const { period, dateValue } = req.query;

        const currentDate = new Date();
        const expWhere = role === "super_admin" ? { institute_id: null } : { institute_id };

        // 1. Determine Date Ranges for Chart & Totals
        let loopStartMonth = currentDate.getMonth();
        let loopStartYear = currentDate.getFullYear();
        let loopCount = 6;
        let isDaily = false;

        let chartStartDate, chartEndDate;
        let totalDateFilter = null;

        if (period === 'month' && dateValue) {
            const [y, m] = dateValue.split('-');
            loopStartYear = parseInt(y);
            loopStartMonth = parseInt(m) - 1;
            isDaily = true;
            loopCount = new Date(loopStartYear, loopStartMonth + 1, 0).getDate();
            
            chartStartDate = new Date(loopStartYear, loopStartMonth, 1);
            chartEndDate = new Date(loopStartYear, loopStartMonth + 1, 0, 23, 59, 59);
            totalDateFilter = { [Op.between]: [chartStartDate, chartEndDate] };

        } else if (period === 'year' && dateValue) {
            loopStartYear = parseInt(dateValue);
            loopStartMonth = 11; // December
            loopCount = 12; // Whole year
            
            chartStartDate = new Date(loopStartYear, 0, 1);
            chartEndDate = new Date(loopStartYear, 11, 31, 23, 59, 59);
            totalDateFilter = { [Op.between]: [chartStartDate, chartEndDate] };

        } else if (period === 'all') {
            loopCount = 12; // Last 12 months for chart
            chartStartDate = new Date(loopStartYear, loopStartMonth - 11, 1);
            chartEndDate = new Date(loopStartYear, loopStartMonth + 1, 0, 23, 59, 59);
            totalDateFilter = null; // ALL TIME for totals

        } else {
            // Default: current_month
            isDaily = true;
            loopCount = new Date(loopStartYear, loopStartMonth + 1, 0).getDate();
            
            chartStartDate = new Date(loopStartYear, loopStartMonth, 1);
            chartEndDate = new Date(loopStartYear, loopStartMonth + 1, 0, 23, 59, 59);
            totalDateFilter = { [Op.between]: [chartStartDate, chartEndDate] };
        }

        // 2. Fetch Data in Batches (Eliminates N+1 queries)
        
        // --- For Chart Data (Bounded by chartStartDate and chartEndDate) ---
        const chartExpWhere = { ...expWhere, date: { [Op.between]: [chartStartDate, chartEndDate] } };
        const expensesChartRaw = await Expense.findAll({
            where: chartExpWhere,
            attributes: ['amount', 'date']
        });

        let incomesChartRaw = [];
        if (role === "super_admin") {
            incomesChartRaw = await Subscription.findAll({
                where: { payment_status: "paid", createdAt: { [Op.between]: [chartStartDate, chartEndDate] } },
                attributes: ['amount_paid', 'createdAt']
            });
        } else {
            incomesChartRaw = await Payment.findAll({
                where: { institute_id, status: "success", payment_date: { [Op.between]: [chartStartDate, chartEndDate] } },
                attributes: ['amount_paid', 'payment_date']
            });
        }

        // --- For Overall Totals (Uses totalDateFilter) ---
        let expensesTotal = 0;
        let incomeTotal = 0;

        if (totalDateFilter) {
            // If the chart range is the same as the total range, just sum the arrays!
            expensesTotal = expensesChartRaw.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
            incomeTotal = incomesChartRaw.reduce((sum, i) => sum + (parseFloat(i.amount_paid) || 0), 0);
        } else {
            // Period === 'all', so we need to fetch the sums across ALL time
            expensesTotal = await Expense.sum("amount", { where: expWhere }) || 0;
            if (role === "super_admin") {
                incomeTotal = await Subscription.sum("amount_paid", { where: { payment_status: "paid" } }) || 0;
            } else {
                incomeTotal = await Payment.sum("amount_paid", { where: { institute_id, status: "success" } }) || 0;
            }
        }

        // 3. Process into Chart Data Array (In-memory mapping)
        const chartData = [];

        if (isDaily) {
            // Map by day
            const expMap = {};
            expensesChartRaw.forEach(e => {
                const d = new Date(e.date).getDate();
                expMap[d] = (expMap[d] || 0) + parseFloat(e.amount || 0);
            });
            const incMap = {};
            incomesChartRaw.forEach(i => {
                const dateVal = i.createdAt || i.payment_date;
                const d = new Date(dateVal).getDate();
                incMap[d] = (incMap[d] || 0) + parseFloat(i.amount_paid || 0);
            });

            for (let i = 1; i <= loopCount; i++) {
                const dayStart = new Date(loopStartYear, loopStartMonth, i);
                const dayLabel = dayStart.toLocaleString('default', { day: 'numeric', month: 'short' });
                chartData.push({ 
                    month: dayLabel, 
                    income: incMap[i] || 0, 
                    expense: expMap[i] || 0 
                });
            }
        } else {
            // Map by year-month
            const expMap = {};
            expensesChartRaw.forEach(e => {
                const d = new Date(e.date);
                const key = `${d.getFullYear()}-${d.getMonth()}`;
                expMap[key] = (expMap[key] || 0) + parseFloat(e.amount || 0);
            });
            const incMap = {};
            incomesChartRaw.forEach(i => {
                const dateVal = i.createdAt || i.payment_date;
                const d = new Date(dateVal);
                const key = `${d.getFullYear()}-${d.getMonth()}`;
                incMap[key] = (incMap[key] || 0) + parseFloat(i.amount_paid || 0);
            });

            for (let i = loopCount - 1; i >= 0; i--) {
                const d = new Date(loopStartYear, loopStartMonth - i, 1);
                const key = `${d.getFullYear()}-${d.getMonth()}`;
                const monthLabel = period === 'year' ? d.toLocaleString('default', { month: 'short' }) : d.toLocaleString('default', { month: 'short', year: '2-digit' });
                chartData.push({ 
                    month: monthLabel, 
                    income: incMap[key] || 0, 
                    expense: expMap[key] || 0 
                });
            }
        }

        const profitLoss = incomeTotal - expensesTotal;
        const burnRate = expensesTotal;

        res.status(200).json({
            success: true,
            stats: {
                totalExpense: expensesTotal,
                totalIncome: incomeTotal,
                profitLoss,
                burnRate
            },
            chartData
        });

    } catch (error) {
        console.error("Error fetching expense stats:", error);
        res.status(500).json({ success: false, message: "Failed to fetch stats" });
    }
};
