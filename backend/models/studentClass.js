/**
 * StudentClass — Enrollment Journal Model
 *
 * Phase 1-2 (Academic Year Promotion): Extended from a 3-field junction table
 * into a versioned enrollment journal. Every promotion closes the current
 * enrollment row (sets enrollment_status='completed', exited_at=today) and
 * opens a new row (enrollment_status='active', new academic_year_id).
 *
 * Original fields preserved: student_id, class_id, institute_id.
 * New fields added: academic_year_id, enrollment_status, enrolled_at, exited_at.
 */
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const StudentClass = sequelize.define("StudentClass", {
    // ── Original fields (preserved) ─────────────────────────────────────────
    student_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    class_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    institute_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    // ── Enrollment Journal fields (Phase 2 — Academic Year Promotion) ────────
    academic_year_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "FK to academic_years; null for legacy rows before migration",
    },
    enrollment_status: {
        type: DataTypes.STRING(20),
        defaultValue: "active",
        comment: "active | completed | transferred | dropped | graduated | repeating",
    },
    enrolled_at: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: "Date this enrollment row became active",
    },
    exited_at: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: "Date this enrollment was closed (null = still active)",
    },
}, {
    tableName: "student_classes",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
});

module.exports = StudentClass;

