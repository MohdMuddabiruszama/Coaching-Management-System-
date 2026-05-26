const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Mark = sequelize.define("Mark", {
    institute_id: DataTypes.INTEGER,
    exam_id: DataTypes.INTEGER,
    student_id: DataTypes.INTEGER,
    subject_id: DataTypes.INTEGER,
    marks_obtained: DataTypes.DECIMAL(5, 2),
    max_marks: DataTypes.DECIMAL(5, 2),
    // ─── Phase 1: Approach B additions ───────────────────────
    is_absent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    remarks: {
        type: DataTypes.STRING(200),
        allowNull: true,
    },
});

module.exports = Mark;
