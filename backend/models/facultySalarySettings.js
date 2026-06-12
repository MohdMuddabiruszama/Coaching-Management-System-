/**
 * FacultySalarySettings Model
 * Stores the base salary configuration per faculty per institute.
 * The auto-generate cron reads from here to create monthly pending records.
 * Admin sets it once; system uses it every month automatically.
 * Phase 2 — Faculty Salary.md
 */
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const FacultySalarySettings = sequelize.define("FacultySalarySettings", {
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
        allowNull: false,
        comment: 'References users.id (faculty role)'
    },
    basic_salary: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Base monthly salary before attendance adjustment'
    },
    allowances: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.00,
        comment: 'Fixed monthly allowances (HRA, Travel, etc.)'
    },
    salary_due_day: {
        type: DataTypes.SMALLINT,
        defaultValue: 5,
        comment: 'Day of month salary is due: 1–28 (safe for all months)'
    },
    working_days_default: {
        type: DataTypes.SMALLINT,
        defaultValue: 26,
        comment: 'Default working days per month for pro-rata calculation'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Inactive settings are skipped by auto-generate cron'
    },
}, {
    tableName: "faculty_salary_settings",
    timestamps: true,
    underscored: true,
    indexes: [
        { unique: true, fields: ['faculty_id', 'institute_id'] },
        { fields: ['institute_id'] }
    ]
});

module.exports = FacultySalarySettings;
