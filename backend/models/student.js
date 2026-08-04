/**
 * Student Model
 *
 * Phase 2 (Academic Year Promotion): Added student_status and
 * current_academic_year_id as fast-read cache columns.
 * The authoritative enrollment history lives in student_classes.
 */
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Student = sequelize.define("Student", {
    // ── Original fields (preserved) ──────────────────────────────────────────
    institute_id: DataTypes.INTEGER,
    user_id: DataTypes.INTEGER,
    roll_number: DataTypes.STRING,
    class_id: DataTypes.INTEGER,
    admission_date: DataTypes.DATEONLY,
    leave_date: DataTypes.DATEONLY,
    date_of_birth: DataTypes.DATEONLY,

    gender: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["male", "female", "other"]] }
    },
    address: DataTypes.TEXT,
    is_full_course: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    // ── Academic Year Promotion fields (Phase 2) ──────────────────────────────
    student_status: {
        type: DataTypes.STRING(20),
        defaultValue: "active",
        comment: "active | graduated | alumni | dropped | transferred | archived | promoted",
    },
    current_academic_year_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "FK to academic_years (fast-read cache); updated on each promotion",
    },
}, {
    tableName:  "students",
    timestamps: true,
    paranoid:   true,   // ✅ Soft delete: destroy() sets deleted_at; findAll() filters deleted rows
});


module.exports = Student;
