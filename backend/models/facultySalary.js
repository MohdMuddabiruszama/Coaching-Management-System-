const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const FacultySalary = sequelize.define("FacultySalary", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    institute_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    faculty_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    month_year: {
        type: DataTypes.STRING(7),  // '2026-04'
        allowNull: false
    },
    basic_salary: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    allowances: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    deductions: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    advance_paid: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    net_salary: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    payment_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    payment_method: {
        type: DataTypes.STRING(20),
        validate: { isIn: [['cash', 'bank_transfer', 'upi', 'cheque']] },
        defaultValue: 'bank_transfer'
    },
    transaction_ref: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(20),
        validate: { isIn: [['pending', 'paid', 'on_hold']] },
        defaultValue: 'pending'
    },
    working_days: {
        type: DataTypes.INTEGER,
        defaultValue: 26
    },
    present_days: {
        type: DataTypes.INTEGER,
        defaultValue: 26
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    paid_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    // ── Phase 1: New fields ───────────────────────────────────────────────────
    payment_due_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Specific date salary should be disbursed (e.g. 2026-06-05)'
    },
    salary_slip_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Path to generated PDF salary slip'
    },
    auto_generated: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'TRUE if created by cron job automatically'
    },
}, {
    tableName: "faculty_salaries",
    timestamps: true
});

module.exports = FacultySalary;
