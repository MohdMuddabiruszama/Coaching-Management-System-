/**
 * AcademicYear Model
 * Phase 2 — Academic Year Promotion Engine
 *
 * One row per institute per academic year.
 * Exactly one row can be 'is_current = true' per institute at any time
 * (enforced by partial unique index uq_one_current_year created in Phase 1 migration).
 */
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AcademicYear = sequelize.define("AcademicYear", {
    institute_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    label: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: "e.g. 2025-26",
    },
    start_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    end_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    is_current: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: "active",
        validate: {
            isIn: [["active", "closed"]],
        },
    },
}, {
    tableName: "academic_years",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
});

module.exports = AcademicYear;
