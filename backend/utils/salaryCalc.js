/**
 * Salary Calculation Utility
 * Pure functions — no side effects, no DB calls.
 * Time complexity: O(1) for all operations.
 * Phase 3 — Faculty Salary.md
 */

/**
 * Compute earned salary and net salary using pro-rata attendance.
 * Formula: earned = (present_days / working_days) * basic_salary
 *          net = earned + allowances - deductions - advance_paid
 *
 * @returns {{ earned_salary, net_salary, attendance_pct }}
 */
function computeNetSalary({ basic_salary, allowances = 0, deductions = 0,
                            advance_paid = 0, present_days, working_days }) {
    const base    = parseFloat(basic_salary)  || 0;
    const allow   = parseFloat(allowances)    || 0;
    const deduct  = parseFloat(deductions)    || 0;
    const advance = parseFloat(advance_paid)  || 0;
    const pd      = parseFloat(present_days)  || 0;
    const wd      = parseFloat(working_days)  || 26;

    const factor       = wd > 0 ? pd / wd : 1;
    const earnedSalary = parseFloat((base * factor).toFixed(2));
    const netSalary    = parseFloat((earnedSalary + allow - deduct - advance).toFixed(2));

    return {
        earned_salary:  earnedSalary,
        net_salary:     netSalary,
        attendance_pct: parseFloat(((pd / (wd || 1)) * 100).toFixed(1)),
    };
}

/**
 * Build payment_due_date from month_year + due_day.
 * Example: month_year='2026-06', due_day=5 → '2026-06-05'
 * Caps at 28 to safely handle February.
 */
function buildDueDate(month_year, due_day) {
    const safeDueDay = Math.min(parseInt(due_day) || 5, 28);
    const day = String(safeDueDay).padStart(2, '0');
    return `${month_year}-${day}`;
}

/**
 * Get current month in YYYY-MM format
 */
function getCurrentMonthYear() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

module.exports = { computeNetSalary, buildDueDate, getCurrentMonthYear };
