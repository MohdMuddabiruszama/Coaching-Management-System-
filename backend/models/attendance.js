const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Attendance = sequelize.define("Attendance", {
    institute_id: DataTypes.INTEGER,
    student_id: DataTypes.INTEGER,
    class_id: DataTypes.INTEGER,
    subject_id: DataTypes.INTEGER,
    date: DataTypes.DATEONLY,
    status: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["present", "absent", "late", "holiday", "half_day"]] }
    },
    marked_by: DataTypes.INTEGER,
    remarks: DataTypes.TEXT,
    // Biometric fields
    marked_by_type: {
        type: DataTypes.STRING(20),
        validate: { isIn: [["manual", "biometric", "mobile_otp", "qr_code", "qr"]] },
        defaultValue: "manual"
    },
    biometric_punch_id: { type: DataTypes.BIGINT, allowNull: true },
    time_in: { type: DataTypes.TIME, allowNull: true },
    time_out: { type: DataTypes.TIME, allowNull: true },
    is_late: { type: DataTypes.BOOLEAN, defaultValue: false },
    late_by_minutes: { type: DataTypes.INTEGER, defaultValue: 0 },
    is_half_day: { type: DataTypes.BOOLEAN, defaultValue: false },
    source_meta: { type: DataTypes.JSON, allowNull: true },
    version: { type: DataTypes.INTEGER, defaultValue: 1 },
}, {
    tableName: "attendances",
    timestamps: true,
    underscored: true,
    indexes: [
        {
            // Named index — Sequelize tracks by name, preventing duplicates on restart
            name: "attendance_unique_daily",
            unique: true,
            fields: ["institute_id", "student_id", "class_id", "date", "subject_id"]
        }
    ]
});

module.exports = Attendance;
