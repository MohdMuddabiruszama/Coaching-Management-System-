const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Exam Model — Phase 3 (Approach B)
 * Using DataTypes.STRING for exam_type (not ENUM) to avoid
 * PostgreSQL ENUM type creation issues with sequelize.sync()
 * The check constraint is enforced at the application layer.
 */
const Exam = sequelize.define("Exam", {
    institute_id: DataTypes.INTEGER,
    class_id: DataTypes.INTEGER,
    subject_id: DataTypes.INTEGER,
    name: DataTypes.STRING,
    exam_date: DataTypes.DATEONLY,
    total_marks: DataTypes.DECIMAL(5, 2),
    passing_marks: DataTypes.DECIMAL(5, 2),

    // ─── Approach B: Exam type (VARCHAR — no PG ENUM issues) ──
    exam_type: {
        type: DataTypes.STRING(20),
        defaultValue: 'unit_test',
        allowNull: false,
    },

    // ─── Approach B: Lock / Publish results ───────────────────
    marks_locked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    marks_locked_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    marks_locked_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
});

module.exports = Exam;
